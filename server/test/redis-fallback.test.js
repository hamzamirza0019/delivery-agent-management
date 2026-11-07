import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { beforeEach, mock, test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const userId = randomUUID();
const listKey = `agents:list:${userId}`;
const detailKey = (id) => `agents:${userId}:${id}`;
const agent = {
  id: "57ec998d-6c3a-4734-8cc0-b91a24a7aa2f",
  name: "Example Agent",
  email: "agent@example.com",
  phone: "5550001234",
  serviceArea: "Central",
  status: "ACTIVE",
  userId,
};
const input = {
  name: agent.name,
  email: agent.email,
  phone: agent.phone,
  serviceArea: agent.serviceArea,
};
const prisma = { deliveryAgent: {} };
const redis = {};
const app = {};
let serverImport = 0;

mock.module("../src/config/database.js", { defaultExport: prisma });
mock.module("../src/config/redis.js", { defaultExport: redis });
mock.module("../src/app.js", { defaultExport: app });
mock.module("dotenv/config", { namedExports: {} });

const agentService = await import("../src/services/agent.service.js");
const service = {
  createAgent: (data) => agentService.createAgent(data, userId),
  getAllAgents: () => agentService.getAllAgents(userId),
  getAgentById: (id) => agentService.getAgentById(id, userId),
  updateAgent: (id, data) => agentService.updateAgent(id, data, userId),
  deleteAgent: (id) => agentService.deleteAgent(id, userId),
};

beforeEach((context) => {
  context.mock.method(console, "log", () => {});
  context.mock.method(console, "error", () => {});
  context.mock.method(console, "warn", () => {});
  redis.isReady = true;
  redis.isOpen = false;
  redis.get = mock.fn(async () => null);
  redis.set = mock.fn(async () => "OK");
  redis.del = mock.fn(async () => 1);
  redis.connect = mock.fn(async () => {});
  redis.on = mock.fn(() => redis);
  prisma.$connect = mock.fn(async () => {});
  prisma.$disconnect = mock.fn(async () => {});
  prisma.deliveryAgent.create = mock.fn(async () => agent);
  prisma.deliveryAgent.findMany = mock.fn(async () => [agent]);
  prisma.deliveryAgent.findUnique = mock.fn(async () => agent);
  prisma.deliveryAgent.update = mock.fn(async () => agent);
  prisma.deliveryAgent.delete = mock.fn(async () => agent);
  app.listen = mock.fn(() => {});
});

test("cache misses preserve owner filters and populate user-scoped keys with EX 60", async () => {
  assert.deepEqual(await service.getAllAgents(), [agent]);
  assert.deepEqual(await service.getAgentById(agent.id), agent);
  assert.deepEqual(prisma.deliveryAgent.findMany.mock.calls[0].arguments, [
    { where: { userId }, orderBy: { createdAt: "desc" } },
  ]);
  assert.deepEqual(prisma.deliveryAgent.findUnique.mock.calls[0].arguments, [
    { where: { id: agent.id, userId } },
  ]);
  assert.deepEqual(redis.set.mock.calls.map((call) => call.arguments), [
    [listKey, JSON.stringify([agent]), { EX: 60 }],
    [detailKey(agent.id), JSON.stringify(agent), { EX: 60 }],
  ]);
  for (const key of [listKey, detailKey(agent.id)]) {
    assert(console.log.mock.calls.some((call) => call.arguments[0] === `[REDIS] CACHE SET - ${key} - TTL: 60s`));
  }
});

test("cache hits bypass PostgreSQL and cache writes", async () => {
  redis.get = mock.fn(async (key) => JSON.stringify(key === listKey ? [agent] : agent));
  assert.deepEqual(await service.getAllAgents(), [agent]);
  assert.deepEqual(await service.getAgentById(agent.id), agent);
  assert.equal(prisma.deliveryAgent.findMany.mock.callCount(), 0);
  assert.equal(prisma.deliveryAgent.findUnique.mock.callCount(), 0);
  assert.equal(redis.set.mock.callCount(), 0);
});

test("an unready Redis client is bypassed for all CRUD operations", async () => {
  redis.isReady = false;
  assert.deepEqual(await service.getAllAgents(), [agent]);
  assert.deepEqual(await service.getAgentById(agent.id), agent);
  assert.equal(await service.createAgent(input), agent);
  assert.equal(await service.updateAgent(agent.id, { status: "INACTIVE" }), agent);
  assert.equal(await service.deleteAgent(agent.id), agent);
  assert.equal(redis.get.mock.callCount(), 0);
  assert.equal(redis.set.mock.callCount(), 0);
  assert.equal(redis.del.mock.callCount(), 0);
});

test("Redis GET failures fall back to PostgreSQL", async () => {
  redis.get = mock.fn(async () => { throw new Error("Redis GET unavailable"); });
  assert.deepEqual(await service.getAllAgents(), [agent]);
  assert.deepEqual(await service.getAgentById(agent.id), agent);
  assert.equal(console.error.mock.callCount(), 2);
});

test("malformed cached JSON falls back instead of reaching error middleware", async () => {
  redis.get = mock.fn(async () => "not JSON");
  assert.deepEqual(await service.getAllAgents(), [agent]);
  assert.deepEqual(await service.getAgentById(agent.id), agent);
  assert.equal(console.error.mock.callCount(), 2);
});

test("Redis SET failures do not fail database reads", async () => {
  redis.set = mock.fn(async () => { throw new Error("Redis SET unavailable"); });
  assert.deepEqual(await service.getAllAgents(), [agent]);
  assert.deepEqual(await service.getAgentById(agent.id), agent);
  assert.equal(console.error.mock.callCount(), 2);
  assert(!console.log.mock.calls.some((call) => call.arguments[0].includes("CACHE SET")));
});

test("mutations preserve query arguments and invalidate only after database success", async () => {
  redis.del = mock.fn(async () => {
    assert.equal(prisma.deliveryAgent.create.mock.callCount(), 1);
    return 1;
  });
  await service.createAgent(input);
  await service.updateAgent(agent.id, { status: "INACTIVE" });
  await service.deleteAgent(agent.id);
  assert.deepEqual(prisma.deliveryAgent.create.mock.calls[0].arguments, [{ data: { ...input, userId } }]);
  assert.deepEqual(prisma.deliveryAgent.update.mock.calls[0].arguments, [
    { where: { id: agent.id, userId }, data: { status: "INACTIVE" } },
  ]);
  assert.deepEqual(prisma.deliveryAgent.delete.mock.calls[0].arguments, [
    { where: { id: agent.id, userId } },
  ]);
  assert.deepEqual(redis.del.mock.calls.map((call) => call.arguments), [
    [[listKey]],
    [[listKey, detailKey(agent.id)]],
    [[listKey, detailKey(agent.id)]],
  ]);
  assert.equal(console.log.mock.calls.filter((call) => call.arguments[0] === `[REDIS] CACHE INVALIDATED - ${listKey}`).length, 3);
  assert.equal(console.log.mock.calls.filter((call) => call.arguments[0] === `[REDIS] CACHE INVALIDATED - ${detailKey(agent.id)}`).length, 2);
});

test("Redis invalidation failures do not fail create, update, or delete", async () => {
  redis.del = mock.fn(async () => { throw new Error("Redis DELETE unavailable"); });
  assert.equal(await service.createAgent(input), agent);
  assert.equal(await service.updateAgent(agent.id, { status: "INACTIVE" }), agent);
  assert.equal(await service.deleteAgent(agent.id), agent);
  assert.equal(console.error.mock.callCount(), 3);
  assert(!console.log.mock.calls.some((call) => call.arguments[0].includes("CACHE INVALIDATED")));
});

test("a missing individual agent still produces the existing 404", async () => {
  redis.isReady = false;
  prisma.deliveryAgent.findUnique = mock.fn(async () => null);
  await assert.rejects(service.getAgentById(agent.id), {
    statusCode: 404,
    message: "Delivery agent not found",
  });
  assert.equal(redis.set.mock.callCount(), 0);
});

test("database failures remain failures and do not trigger cache mutations", async () => {
  const databaseError = new Error("Database unavailable");
  for (const operation of ["create", "findMany", "findUnique", "update", "delete"]) {
    prisma.deliveryAgent[operation] = mock.fn(async () => { throw databaseError; });
  }
  for (const operation of [
    () => service.createAgent(input),
    () => service.getAllAgents(),
    () => service.getAgentById(agent.id),
    () => service.updateAgent(agent.id, input),
    () => service.deleteAgent(agent.id),
  ]) {
    await assert.rejects(operation(), (error) => error === databaseError);
  }
  assert.equal(redis.set.mock.callCount(), 0);
  assert.equal(redis.del.mock.callCount(), 0);
});

test("caching resumes when the client becomes ready again", async () => {
  redis.isReady = false;
  await service.getAllAgents();
  redis.isReady = true;
  await service.getAllAgents();
  redis.get = mock.fn(async () => JSON.stringify([agent]));
  assert.deepEqual(await service.getAllAgents(), [agent]);
  assert.equal(prisma.deliveryAgent.findMany.mock.callCount(), 2);
  assert.equal(redis.set.mock.callCount(), 1);
});

test("services reject missing user context before querying PostgreSQL or Redis", async () => {
  for (const operation of [
    () => agentService.createAgent(input),
    () => agentService.getAllAgents(),
    () => agentService.getAgentById(agent.id),
    () => agentService.updateAgent(agent.id, input),
    () => agentService.deleteAgent(agent.id),
  ]) await assert.rejects(operation(), { statusCode: 401 });
  assert.equal(redis.get.mock.callCount(), 0);
  assert.equal(prisma.deliveryAgent.findMany.mock.callCount(), 0);
  assert.equal(prisma.deliveryAgent.create.mock.callCount(), 0);
});

const loadServer = async () => {
  await import(`../src/server.js?test=${++serverImport}`);
  await new Promise(setImmediate);
};

test("a listen error is logged instead of falsely reporting a running HTTP server", async () => {
  app.listen = mock.fn((port, callback) => callback(new Error("listen EADDRINUSE")));
  await loadServer();
  assert.deepEqual(console.error.mock.calls[0].arguments, ["Failed to start HTTP server:", "listen EADDRINUSE"]);
  assert(!console.log.mock.calls.some((call) => call.arguments[0].startsWith("Server running on ")));
});

test("startup listens even while Redis connect remains pending", async () => {
  redis.connect = mock.fn(() => new Promise(() => {}));
  await loadServer();
  assert.equal(prisma.$connect.mock.callCount(), 1);
  assert.equal(redis.connect.mock.callCount(), 1);
  assert.equal(app.listen.mock.callCount(), 1);
  assert.equal(prisma.$disconnect.mock.callCount(), 0);
  const readyListener = redis.on.mock.calls.find((call) => call.arguments[0] === "ready");
  readyListener.arguments[1]();
  assert.equal(console.log.mock.calls.at(-1).arguments[0], "Redis connected successfully");
});

test("a rejected Redis connection warns without stopping startup", async () => {
  redis.connect = mock.fn(async () => { throw new Error("Redis connection refused"); });
  await loadServer();
  assert.equal(app.listen.mock.callCount(), 1);
  assert.equal(prisma.$disconnect.mock.callCount(), 0);
  assert.equal(console.warn.mock.callCount(), 1);
});

for (const isReady of [false, true]) {
  test(`startup does not reconnect an open client (isReady=${isReady})`, async () => {
    redis.isOpen = true;
    redis.isReady = isReady;
    await loadServer();
    assert.equal(redis.connect.mock.callCount(), 0);
    assert.equal(app.listen.mock.callCount(), 1);
  });
}

test("PostgreSQL connection failure remains fatal and disconnects Prisma", async (context) => {
  prisma.$connect = mock.fn(async () => { throw new Error("PostgreSQL unavailable"); });
  context.mock.method(process, "exit", () => {});
  await loadServer();
  assert.equal(app.listen.mock.callCount(), 0);
  assert.equal(redis.connect.mock.callCount(), 0);
  assert.equal(prisma.$disconnect.mock.callCount(), 1);
  assert.deepEqual(process.exit.mock.calls[0].arguments, [1]);
});

test("actual Redis client times out stalled sockets and keeps retrying without offline queueing", async () => {
  const script = `
    import assert from "node:assert/strict";
    import { once } from "node:events";
    import { createServer } from "node:net";
    const sockets = new Set();
    const server = createServer((socket) => { sockets.add(socket); });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    process.env.REDIS_URL = "redis://127.0.0.1:" + server.address().port;
    const { default: redis } = await import("./src/config/redis.js");
    try {
      const failure = once(redis, "error");
      const reconnecting = new Promise((resolve) => redis.once("reconnecting", resolve));
      const connection = redis.connect().catch(() => {});
      const [error] = await failure;
      assert.match(error.message, /timeout/i);
      assert.equal(redis.isReady, false);
      assert.equal(redis.isOpen, true);
      await assert.rejects(redis.get("agents:list"), /offline/i);
      await reconnecting;
      assert.equal(redis.isOpen, true);
      redis.destroy();
      await connection;
    } finally {
      redis.destroy();
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  `;
  await promisify(execFile)(process.execPath, ["--input-type=module", "-e", script], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    timeout: 10000,
  });
});