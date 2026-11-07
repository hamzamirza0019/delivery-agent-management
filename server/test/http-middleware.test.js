import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import app from "../src/app.js";
import prisma from "../src/config/database.js";
import jwt from "jsonwebtoken";

let server;
let base;
const authorization = `Bearer ${jwt.sign({}, process.env.JWT_SECRET, {
  subject: randomUUID(), expiresIn: "1h", issuer: "agent-hub", audience: "agent-hub",
})}`;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

test("malformed JSON returns a generic HTTP 400 without echoing submitted data", async () => {
  const response = await fetch(`${base}/api/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "SECRET",
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    success: false,
    message: "Invalid JSON body",
  });
});

test("health, Helmet, CORS and unmatched routes preserve the HTTP contract", async () => {
  const health = await fetch(`${base}/api/health`, { headers: { Origin: "http://example.com" } });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("x-content-type-options"), "nosniff");
  assert.equal(health.headers.get("access-control-allow-origin"), "*");
  assert.deepEqual(await health.json(), {
    success: true,
    message: "Delivery Agent Management API is running",
  });
  const missing = await fetch(`${base}/api/not-a-route`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { success: false, message: "Route not found" });
});

for (const method of ["GET", "PATCH", "DELETE"]) {
  test(`${method} rejects an invalid UUID through HTTP without reaching the database`, async () => {
    const response = await fetch(`${base}/api/agents/not-a-uuid`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: authorization },
      ...(method === "PATCH" ? {
        body: JSON.stringify({ name: "Example Agent" }),
      } : {}),
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.message, "Validation failed");
    assert(body.errors.some((error) => error.field === "id"));
  });
}

test("an actual async Prisma connection failure becomes a safe HTTP 500", async () => {
  const script = `
    import assert from "node:assert/strict";
    import { once } from "node:events";
    import { createServer } from "node:net";
    import { randomUUID } from "node:crypto";
    import jwt from "jsonwebtoken";
    const socket = createServer();
    socket.listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise(resolve => socket.close(resolve));
    process.env.DATABASE_URL = "postgresql://unused:unused@127.0.0.1:" + port + "/unused?connect_timeout=1";
    const { default: app } = await import("./src/app.js");
    const { default: prisma } = await import("./src/config/database.js");
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const token = jwt.sign({}, process.env.JWT_SECRET, { subject: randomUUID(), expiresIn: "1h", issuer: "agent-hub", audience: "agent-hub" });
      const response = await fetch("http://127.0.0.1:" + server.address().port + "/api/agents", { headers: { Authorization: "Bearer " + token } });
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { success: false, message: "Internal server error" });
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
      await prisma.$disconnect();
    }
  `;
  await promisify(execFile)(process.execPath, ["--input-type=module", "-e", script], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    timeout: 10000,
  });
});