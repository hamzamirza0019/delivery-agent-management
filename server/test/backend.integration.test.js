import "dotenv/config";
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Client } from "pg";
import { createClient } from "redis";

const enabled = process.env.RUN_INTEGRATION === "1";
const outages = process.env.RUN_REDIS_OUTAGE === "1";
const execute = promisify(execFile);
const serverRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const databaseName = `delivery_audit_${randomUUID().replaceAll("-", "")}`;
const marker = randomUUID().replaceAll("-", "");
const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
const ownedIds = new Set();
let admin;
let database;
let cache;
let child;
let exited;
let logs = "";
let base;
let createdDatabase = false;
let isolatedCache = false;
let redisStopped = false;
let fingerprint;
let sequence = 0;
let primary;
let secondary;
let backendEnvironment;

const freshInput = () => ({
  name: "Audit Agent",
  email: `${marker}-${++sequence}@example.com`,
  phone: `555${Date.now()}${String(sequence).padStart(6, "0")}`,
  serviceArea: `Audit ${marker}`,
});

const request = async (method, endpoint, data) => {
  const response = await fetch(`${base}${endpoint}`, {
    method,
    signal: AbortSignal.timeout(10000),
    ...(data !== undefined ? {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    } : {}),
  });
  const body = await response.json();
  if (method === "POST" && body.data?.id) ownedIds.add(body.data.id);
  return { status: response.status, body };
};

const createAgent = async (input = freshInput()) => {
  const result = await request("POST", "/api/agents", input);
  assert.equal(result.status, 201);
  assert.equal(result.body.success, true);
  return result.body.data;
};

const expectError = (result, status, message) => {
  assert.equal(result.status, status);
  assert.equal(result.body.success, false);
  assert.equal(result.body.message, message);
  assert(!JSON.stringify(result.body).match(/PrismaClient|DATABASE_URL|stack|password|node_modules/));
};

const waitForLog = (text, start = 0) => new Promise((resolve, reject) => {
  const check = () => {
    if (logs.slice(start).includes(text)) {
      cleanup();
      resolve();
    }
  };
  const failed = () => {
    cleanup();
    reject(new Error(`Backend exited before logging: ${text}`));
  };
  const timeout = setTimeout(() => {
    cleanup();
    reject(new Error(`Backend did not log: ${text}`));
  }, 20000);
  const cleanup = () => {
    clearTimeout(timeout);
    child.stdout.off("data", check);
    child.stderr.off("data", check);
    child.off("exit", failed);
  };
  child.stdout.on("data", check);
  child.stderr.on("data", check);
  child.on("exit", failed);
  check();
});

const compose = (...args) => execute("docker", ["compose", ...args], {
  cwd: repoRoot,
  timeout: 30000,
});

const restoreRedis = async () => {
  if (redisStopped) {
    await compose("start", "redis");
    redisStopped = false;
  }
};

const cacheData = async (id) => {
  await request("GET", "/api/agents");
  await request("GET", `/api/agents/${id}`);
  assert.equal(await cache.exists(["agents:list", `agents:${id}`]), 2);
};

const readFingerprint = async () => (await admin.query(
  'SELECT count(*)::int AS count, md5(coalesce(string_agg(row_to_json(agent)::text, \'\' ORDER BY id), \'\')) AS digest FROM "DeliveryAgent" agent'
)).rows[0];

describe("real HTTP, PostgreSQL and Redis integration", { skip: !enabled, concurrency: false }, () => {
  before(async () => {
    assert(databaseUrl && redisUrl, "DATABASE_URL and REDIS_URL must be configured");
    admin = new Client({ connectionString: databaseUrl });
    await admin.connect();
    fingerprint = await readFingerprint();
    const cacheUrl = new URL(redisUrl);
    cacheUrl.pathname = "/15";
    cache = createClient({
      url: cacheUrl.toString(),
      disableOfflineQueue: true,
      socket: {
        connectTimeout: 1000,
        reconnectStrategy: (retries) => Math.min(50 * 2 ** retries, 2000),
      },
    });
    cache.on("error", () => {});
    await cache.connect();
    assert.equal(await cache.dbSize(), 0, "Redis DB 15 must be empty; refusing to alter existing cache data");
    isolatedCache = true;
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    createdDatabase = true;
    const testUrl = new URL(databaseUrl);
    testUrl.pathname = `/${databaseName}`;
    await execute(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
      cwd: serverRoot,
      env: { ...process.env, DATABASE_URL: testUrl.toString() },
      timeout: 30000,
    });
    database = new Client({ connectionString: testUrl.toString() });
    await database.connect();
    const socket = createServer();
    socket.listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));
    base = `http://127.0.0.1:${port}`;
    backendEnvironment = {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      DATABASE_URL: testUrl.toString(),
      REDIS_URL: cacheUrl.toString(),
    };
    child = spawn(process.execPath, ["src/server.js"], {
      cwd: serverRoot,
      env: backendEnvironment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    exited = once(child, "exit");
    child.stdout.on("data", (data) => { logs += data.toString(); });
    child.stderr.on("data", (data) => { logs += data.toString(); });
    await waitForLog("Server running on");
    await waitForLog("Redis connected successfully");
    primary = await createAgent();
    secondary = await createAgent();
  });

  after(async () => {
    const failures = [];
    try { await restoreRedis(); } catch { failures.push(new Error("Redis restart failed; run docker compose start redis")); }
    if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    if (exited) await exited;
    try {
      if (cache && isolatedCache) {
        if (!cache.isReady) await once(cache, "ready", { signal: AbortSignal.timeout(20000) });
        await cache.del(["agents:list", ...[...ownedIds].map((id) => `agents:${id}`)]);
        assert.equal(await cache.dbSize(), 0, "Integration cache cleanup must leave Redis DB 15 empty");
      }
    } catch (error) { failures.push(error); }
    cache?.destroy();
    if (database) await database.end();
    try {
      if (createdDatabase) await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
      if (fingerprint) assert.deepEqual(await readFingerprint(), fingerprint, "Development records changed during the audit");
    } catch (error) { failures.push(error); }
    if (admin) await admin.end();
    if (failures.length) throw new AggregateError(failures, "Integration cleanup failed");
  });

  test("health responds through the actual backend entrypoint", async () => {
    const result = await request("GET", "/api/health");
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { success: true, message: "Delivery Agent Management API is running" });
  });

  test("valid creation returns 201, exact fields, ACTIVE default, UUID and timestamps", async () => {
    const input = freshInput();
    const result = await request("POST", "/api/agents", input);
    assert.equal(result.status, 201);
    assert.deepEqual(Object.keys(result.body).sort(), ["data", "message", "success"]);
    assert.equal(result.body.message, "Delivery agent created successfully");
    assert.equal(result.body.success, true);
    const agent = result.body.data;
    assert.deepEqual(Object.keys(agent).sort(), ["createdAt", "email", "id", "name", "phone", "serviceArea", "status", "updatedAt"]);
    for (const [field, value] of Object.entries(input)) assert.equal(agent[field], value);
    assert.equal(agent.status, "ACTIVE");
    assert.match(agent.id, /^[0-9a-f-]{36}$/);
    assert(Number.isFinite(Date.parse(agent.createdAt)) && Number.isFinite(Date.parse(agent.updatedAt)));
    assert.equal((await database.query('SELECT id FROM "DeliveryAgent" WHERE id = $1', [agent.id])).rowCount, 1);
  });

  test("create trims strings and accepts explicit INACTIVE", async () => {
    const input = freshInput();
    const agent = await createAgent({ ...input, name: "  Trimmed Agent  ", serviceArea: "  North  ", status: "INACTIVE" });
    assert.equal(agent.name, "Trimmed Agent");
    assert.equal(agent.serviceArea, "North");
    assert.equal(agent.status, "INACTIVE");
  });

  for (const field of ["name", "email", "phone", "serviceArea"]) {
    test(`create rejects missing ${field}`, async () => {
      const input = freshInput();
      delete input[field];
      const result = await request("POST", "/api/agents", input);
      expectError(result, 400, "Validation failed");
      assert(result.body.errors.some((error) => error.field === field));
      assert.equal((await database.query('SELECT id FROM "DeliveryAgent" WHERE email = $1', [input.email || "missing@example.com"])).rowCount, 0);
    });
  }

  for (const [label, patch] of [
    ["short name", { name: "A" }],
    ["invalid email", { email: "not-an-email" }],
    ["short phone", { phone: "123" }],
    ["numeric phone", { phone: 1234567890 }],
    ["short service area", { serviceArea: "A" }],
    ["invalid status", { status: "AVAILABLE" }],
    ["unknown fields", { unexpected: true }],
  ]) {
    test(`create rejects ${label}`, async () => {
      expectError(await request("POST", "/api/agents", { ...freshInput(), ...patch }), 400, "Validation failed");
    });
  }

  for (const field of ["email", "phone"]) {
    test(`create rejects duplicate ${field} with a real Prisma P2002 mapped to 409`, async () => {
      expectError(await request("POST", "/api/agents", { ...freshInput(), [field]: secondary[field] }), 409, "Email or phone number already exists");
    });
  }

  test("list returns count, descending creation order and actual record values", async () => {
    const result = await request("GET", "/api/agents");
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    assert.equal(result.body.count, result.body.data.length);
    assert.deepEqual(result.body.data.find((agent) => agent.id === primary.id), primary);
    for (let index = 1; index < result.body.data.length; index++) {
      assert(Date.parse(result.body.data[index - 1].createdAt) >= Date.parse(result.body.data[index].createdAt));
    }
  });

  test("individual retrieval returns the existing record", async () => {
    assert.deepEqual(await request("GET", `/api/agents/${primary.id}`), { status: 200, body: { success: true, data: primary } });
  });

  test("individual retrieval of a nonexistent UUID returns 404", async () => {
    expectError(await request("GET", `/api/agents/${randomUUID()}`), 404, "Delivery agent not found");
  });

  for (const [label, update] of [
    ["name only", () => ({ name: "Updated Audit Agent" })],
    ["phone only", () => ({ phone: freshInput().phone })],
    ["service area only", () => ({ serviceArea: "Updated North" })],
    ["status only", () => ({ status: "INACTIVE" })],
    ["multiple fields", () => ({ name: "Multiple Changes", serviceArea: "South", status: "ACTIVE" })],
  ]) {
    test(`update ${label} persists fields and advances updatedAt`, async () => {
      const patch = update();
      const result = await request("PATCH", `/api/agents/${primary.id}`, patch);
      assert.equal(result.status, 200);
      assert.equal(result.body.message, "Delivery agent updated successfully");
      assert.equal(result.body.success, true);
      for (const [field, value] of Object.entries(patch)) assert.equal(result.body.data[field], value);
      assert.equal(result.body.data.createdAt, primary.createdAt);
      assert(Date.parse(result.body.data.updatedAt) > Date.parse(primary.updatedAt));
      primary = result.body.data;
      assert.deepEqual((await request("GET", `/api/agents/${primary.id}`)).body.data, primary);
      const persisted = (await database.query('SELECT *, "updatedAt" AT TIME ZONE \'UTC\' AS "updatedAt" FROM "DeliveryAgent" WHERE id = $1', [primary.id])).rows[0];
      assert.equal(persisted.updatedAt.toISOString(), primary.updatedAt);
      for (const [field, value] of Object.entries(patch)) assert.equal(persisted[field], value);
    });
  }

  for (const [label, patch] of [
    ["empty body", {}],
    ["short name", { name: "A" }],
    ["invalid email", { email: "invalid" }],
    ["short phone", { phone: "123" }],
    ["short service area", { serviceArea: "A" }],
    ["invalid status", { status: "ON_DELIVERY" }],
    ["unknown fields", { extra: true }],
  ]) {
    test(`update rejects ${label} without modifying the record`, async () => {
      expectError(await request("PATCH", `/api/agents/${primary.id}`, patch), 400, "Validation failed");
      assert.deepEqual((await request("GET", `/api/agents/${primary.id}`)).body.data, primary);
    });
  }

  test("update of a nonexistent UUID returns real P2025 mapped to 404", async () => {
    expectError(await request("PATCH", `/api/agents/${randomUUID()}`, { name: "Missing Agent" }), 404, "Delivery agent not found");
  });

  for (const field of ["email", "phone"]) {
    test(`update rejects duplicate ${field} without changing the record`, async () => {
      expectError(await request("PATCH", `/api/agents/${primary.id}`, { [field]: secondary[field] }), 409, "Email or phone number already exists");
      assert.deepEqual((await request("GET", `/api/agents/${primary.id}`)).body.data, primary);
    });
  }

  test("delete removes the existing record from PostgreSQL, individual reads and lists", async () => {
    const result = await request("DELETE", `/api/agents/${primary.id}`);
    assert.deepEqual(result, { status: 200, body: { success: true, message: "Delivery agent deleted successfully" } });
    expectError(await request("GET", `/api/agents/${primary.id}`), 404, "Delivery agent not found");
    assert(!(await request("GET", "/api/agents")).body.data.some((agent) => agent.id === primary.id));
    assert.equal((await database.query('SELECT id FROM "DeliveryAgent" WHERE id = $1', [primary.id])).rowCount, 0);
  });

  test("delete of a nonexistent UUID returns real P2025 mapped to 404", async () => {
    expectError(await request("DELETE", `/api/agents/${randomUUID()}`), 404, "Delivery agent not found");
  });

  test("list cache miss/hit produces actual Redis JSON and a non-refreshed 60-second TTL", async () => {
    await cache.del("agents:list");
    const start = logs.length;
    const first = await request("GET", "/api/agents");
    await waitForLog("Redis cache MISS: agents:list", start);
    assert.deepEqual(JSON.parse(await cache.get("agents:list")), first.body.data);
    const ttl = await cache.pTTL("agents:list");
    assert(ttl > 55000 && ttl <= 60000);
    const secondStart = logs.length;
    assert.deepEqual(await request("GET", "/api/agents"), first);
    await waitForLog("Redis cache HIT: agents:list", secondStart);
    assert((await cache.pTTL("agents:list")) <= ttl);
  });

  test("individual cache miss/hit produces actual JSON and 60-second TTL", async () => {
    await cache.del(`agents:${secondary.id}`);
    const start = logs.length;
    const first = await request("GET", `/api/agents/${secondary.id}`);
    await waitForLog(`Redis cache MISS: agents:${secondary.id}`, start);
    assert.deepEqual(JSON.parse(await cache.get(`agents:${secondary.id}`)), first.body.data);
    const ttl = await cache.pTTL(`agents:${secondary.id}`);
    assert(ttl > 55000 && ttl <= 60000);
    const secondStart = logs.length;
    assert.deepEqual(await request("GET", `/api/agents/${secondary.id}`), first);
    await waitForLog(`Redis cache HIT: agents:${secondary.id}`, secondStart);
    assert((await cache.pTTL(`agents:${secondary.id}`)) <= ttl);
  });

  test("create invalidates a populated list cache and the next GET includes fresh data", async () => {
    await request("GET", "/api/agents");
    assert.equal(await cache.exists("agents:list"), 1);
    const agent = await createAgent();
    assert.equal(await cache.exists("agents:list"), 0);
    assert((await request("GET", "/api/agents")).body.data.some((item) => item.id === agent.id));
  });

  test("update invalidates populated list/detail caches and the next GET is fresh", async () => {
    await cacheData(secondary.id);
    const result = await request("PATCH", `/api/agents/${secondary.id}`, { serviceArea: "Cache Fresh Area" });
    assert.equal(result.status, 200);
    assert.equal(await cache.exists(["agents:list", `agents:${secondary.id}`]), 0);
    assert.equal((await request("GET", `/api/agents/${secondary.id}`)).body.data.serviceArea, "Cache Fresh Area");
    assert.equal((await request("GET", "/api/agents")).body.data.find((agent) => agent.id === secondary.id).serviceArea, "Cache Fresh Area");
  });

  test("delete invalidates populated list/detail caches and subsequent reads exclude the agent", async () => {
    const agent = await createAgent();
    await cacheData(agent.id);
    assert.equal((await request("DELETE", `/api/agents/${agent.id}`)).status, 200);
    assert.equal(await cache.exists(["agents:list", `agents:${agent.id}`]), 0);
    expectError(await request("GET", `/api/agents/${agent.id}`), 404, "Delivery agent not found");
    assert(!(await request("GET", "/api/agents")).body.data.some((item) => item.id === agent.id));
  });

  test("actual malformed cached JSON falls back to PostgreSQL and repairs the cache", async () => {
    await cache.set(`agents:${secondary.id}`, "invalid JSON", { EX: 60 });
    const result = await request("GET", `/api/agents/${secondary.id}`);
    assert.equal(result.status, 200);
    assert.equal(result.body.data.id, secondary.id);
    assert.deepEqual(JSON.parse(await cache.get(`agents:${secondary.id}`)), result.body.data);
  });

  test("the migrated test database schema and enum match the Prisma contract", async () => {
    const fields = await database.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'DeliveryAgent'");
    assert.deepEqual(fields.rows.map((field) => field.column_name).sort(), ["createdAt", "email", "id", "name", "phone", "serviceArea", "status", "updatedAt"]);
    const statuses = await database.query("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'AgentStatus' ORDER BY enumsortorder");
    assert.deepEqual(statuses.rows.map((status) => status.enumlabel), ["ACTIVE", "INACTIVE"]);
    const migrations = await database.query('SELECT migration_name, finished_at IS NOT NULL AS applied FROM "_prisma_migrations" ORDER BY migration_name');
    assert.equal(migrations.rowCount, 2);
    assert(migrations.rows.every((migration) => migration.applied));
  });

  describe("real Docker Redis outage and recovery", { skip: !outages }, () => {
    let existing;
    let offline;

    before(async () => {
      await compose("exec", "-T", "postgres", "pg_isready");
      await compose("exec", "-T", "redis", "redis-cli", "ping");
      existing = await createAgent();
      await cacheData(existing.id);
      const start = logs.length;
      redisStopped = true;
      await compose("stop", "redis");
      await waitForLog("Redis unavailable; continuing with PostgreSQL:", start);
    });

    after(async () => { await restoreRedis(); });

    test("the backend remains alive and health succeeds while Redis is stopped", async () => {
      assert.equal(child.exitCode, null);
      assert.equal(child.signalCode, null);
      assert.equal((await request("GET", "/api/health")).status, 200);
    });

    test("a new actual backend process starts successfully while Redis is already stopped", async () => {
      const socket = createServer();
      socket.listen(0, "127.0.0.1");
      await once(socket, "listening");
      const port = socket.address().port;
      await new Promise((resolve) => socket.close(resolve));
      const script = `
        import assert from "node:assert/strict";
        const originalLog = console.log;
        const listening = new Promise((resolve) => {
          console.log = (...args) => {
            originalLog(...args);
            if (String(args[0]).startsWith("Server running on ")) resolve();
          };
        });
        await import("./src/server.js");
        await listening;
        const response = await fetch("http://127.0.0.1:" + process.env.PORT + "/api/health");
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { success: true, message: "Delivery Agent Management API is running" });
        process.exit(0);
      `;
      await execute(process.execPath, ["--input-type=module", "-e", script], {
        cwd: serverRoot,
        env: { ...backendEnvironment, PORT: String(port) },
        timeout: 10000,
      });
    });

    test("GET list succeeds against PostgreSQL during a real Redis outage", async () => {
      const result = await request("GET", "/api/agents");
      assert.equal(result.status, 200);
      assert(result.body.data.some((agent) => agent.id === existing.id));
    });

    test("GET individual succeeds during a real Redis outage", async () => {
      assert.deepEqual((await request("GET", `/api/agents/${existing.id}`)).body.data, existing);
    });

    test("POST persists a new agent during a real Redis outage", async () => {
      offline = await createAgent();
      assert.equal((await database.query('SELECT id FROM "DeliveryAgent" WHERE id = $1', [offline.id])).rowCount, 1);
    });

    test("PATCH persists updated fields during a real Redis outage", async () => {
      const result = await request("PATCH", `/api/agents/${offline.id}`, { name: "Offline Updated", status: "INACTIVE" });
      assert.equal(result.status, 200);
      assert.equal(result.body.data.name, "Offline Updated");
      assert.equal((await request("GET", `/api/agents/${offline.id}`)).body.data.status, "INACTIVE");
    });

    test("DELETE removes an agent during a real Redis outage", async () => {
      assert.equal((await request("DELETE", `/api/agents/${offline.id}`)).status, 200);
      expectError(await request("GET", `/api/agents/${offline.id}`), 404, "Delivery agent not found");
      assert(!(await request("GET", "/api/agents")).body.data.some((agent) => agent.id === offline.id));
    });

    test("Redis automatically reconnects and cache miss/hit operations resume without backend restart", async () => {
      const start = logs.length;
      await restoreRedis();
      await waitForLog("Redis connected successfully", start);
      if (!cache.isReady) await once(cache, "ready", { signal: AbortSignal.timeout(20000) });
      assert.equal(await cache.ping(), "PONG");
      await cache.del(["agents:list", `agents:${existing.id}`]);
      const cursor = logs.length;
      const list = await request("GET", "/api/agents");
      await waitForLog("Redis cache MISS: agents:list", cursor);
      const hitCursor = logs.length;
      assert.deepEqual(await request("GET", "/api/agents"), list);
      await waitForLog("Redis cache HIT: agents:list", hitCursor);
      const detailCursor = logs.length;
      assert.equal((await request("GET", `/api/agents/${existing.id}`)).status, 200);
      await waitForLog(`Redis cache MISS: agents:${existing.id}`, detailCursor);
      const detailHitCursor = logs.length;
      assert.equal((await request("GET", `/api/agents/${existing.id}`)).status, 200);
      await waitForLog(`Redis cache HIT: agents:${existing.id}`, detailHitCursor);
      assert((await cache.ttl("agents:list")) > 0 && (await cache.ttl("agents:list")) <= 60);
      assert((await cache.ttl(`agents:${existing.id}`)) > 0);
      assert.equal(child.exitCode, null);
      assert.equal(child.signalCode, null);
    });
  });
});