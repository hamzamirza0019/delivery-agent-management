import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { beforeEach, mock, test } from "node:test";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { registerSchema, loginSchema } from "../src/validators/auth.validator.js";
import { authenticate } from "../src/middleware/auth.middleware.js";

const user = { id: randomUUID(), name: "Auth Test", email: "auth@example.com" };
const password = randomBytes(16).toString("hex");
const hash = await bcrypt.hash(password, 12);
const prisma = { user: {} };
mock.module("../src/config/database.js", { defaultExport: prisma });
const auth = await import("../src/services/auth.service.js");

beforeEach(() => {
  prisma.user.create = mock.fn(async () => user);
  prisma.user.findUnique = mock.fn(async () => ({ ...user, passwordHash: hash }));
});

test("registration validates and normalizes inputs without accepting unknown fields", () => {
  const input = registerSchema.parse({ name: "  Auth Test  ", email: "  AUTH@example.com  ", password });
  assert.equal(input.name, user.name);
  assert.equal(input.email, user.email);
  for (const patch of [{ name: "A" }, { email: "invalid" }, { password: "short" }, { userId: user.id }, { password: "é".repeat(40) }]) {
    assert.equal(registerSchema.safeParse({ ...input, ...patch }).success, false);
  }
  assert.equal(loginSchema.safeParse({ email: user.email, password }).success, true);
});

test("registration bcrypt-hashes passwords and returns a signed expiring token without a hash", async () => {
  const result = await auth.register({ ...user, password });
  const data = prisma.user.create.mock.calls[0].arguments[0].data;
  assert.notEqual(data.passwordHash, password);
  assert(await bcrypt.compare(password, data.passwordHash));
  assert.deepEqual(result.user, user);
  const token = jwt.verify(result.token, process.env.JWT_SECRET, { algorithms: ["HS256"], issuer: "agent-hub", audience: "agent-hub" });
  assert.equal(token.sub, user.id);
  assert(token.exp > token.iat);
  assert(!JSON.stringify(result).includes("passwordHash"));
});

test("registration maps a database email conflict to 409", async () => {
  prisma.user.create = mock.fn(async () => { throw Object.assign(new Error("Unique constraint"), { code: "P2002" }); });
  await assert.rejects(auth.register({ ...user, password }), { statusCode: 409, message: "Email already registered" });
});

test("login authenticates the password and never returns its hash", async () => {
  assert.deepEqual((await auth.login({ email: user.email, password })).user, user);
  await assert.rejects(auth.login({ email: user.email, password: "wrong-password" }), { statusCode: 401, message: "Invalid email or password" });
  prisma.user.findUnique = mock.fn(async () => null);
  await assert.rejects(auth.login({ email: user.email, password }), { statusCode: 401, message: "Invalid email or password" });
});

test("Bearer middleware verifies signature, expiry, algorithm and UUID subject", () => {
  const sign = (options = {}, secret = process.env.JWT_SECRET) => jwt.sign({}, secret, {
    subject: user.id, expiresIn: "1h", issuer: "agent-hub", audience: "agent-hub", ...options,
  });
  const run = (header) => {
    const req = { get: () => header };
    const response = { status: mock.fn(() => response), json: mock.fn() };
    const next = mock.fn();
    authenticate(req, response, next);
    return { req, response, next };
  };
  const success = run(`Bearer ${sign()}`);
  assert.equal(success.req.userId, user.id);
  assert.equal(success.next.mock.callCount(), 1);
  for (const header of [undefined, "Basic invalid", "Bearer invalid", `Bearer ${sign({ expiresIn: -1 })}`, `Bearer ${sign({}, randomBytes(32).toString("hex"))}`, `Bearer ${sign({ algorithm: "HS384" })}`, `Bearer ${sign({ subject: "not-a-uuid" })}`]) {
    const result = run(header);
    assert.equal(result.response.status.mock.calls[0].arguments[0], 401);
    assert.equal(result.next.mock.callCount(), 0);
  }
});