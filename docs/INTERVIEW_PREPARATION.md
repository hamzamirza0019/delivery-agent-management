# Interview Preparation Notebook
## Delivery Agent Management System

This document tracks the technical concepts, implementation details, architectural decisions, and problems encountered while developing this project.

**Purpose:** Use this document for technical interview preparation and project explanation.

**Milestone: 2026-11-06.** The full backend audit passed 74 tests: 51 real HTTP/PostgreSQL/Redis integration tests, six HTTP middleware/error tests, and 17 existing fallback tests. CRUD, validation, cache invalidation, live Docker Redis outage, startup with Redis absent, and automatic recovery were observed. A malformed-JSON input-disclosure defect was fixed. PostgreSQL stayed running, so restart persistence is not verified; neither production readiness nor frontend implementation is claimed.

---

# 1. Project Overview

A full-stack Delivery Agent Management System that allows users to create, retrieve, update, and delete delivery agent records.

### Technology Stack

| Component | Technology |
|---|---|
| Frontend | React + Vite (planned; empty client directory) |
| Backend | Node.js + Express 5, JavaScript ES modules |
| Database | PostgreSQL |
| ORM | Prisma 6.19.3 (initially 7.10.1) |
| Caching | Optional Redis cache-aside implementation, 60-second TTL |
| Validation | Zod |
| Infrastructure | Docker Compose |
| Version Control | Git on main; GitHub submission planned |

---

# 2. Database Concepts

## 2.1 PostgreSQL

PostgreSQL is a relational database management system (RDBMS).

It stores structured data in tables consisting of rows and columns.

**Why PostgreSQL?**
- Relational data storage.
- Unique constraints.
- Transactions.
- Data integrity.
- Persistent storage.

In this project, PostgreSQL stores delivery agent records permanently.

## 2.2 Database Migration

A database migration is a version-controlled record of changes made to the database schema.

Example:

```sql
ALTER TABLE "DeliveryAgent"
ADD COLUMN phone TEXT;
```

This SQL statement adds a phone column to an existing table.

**Why migrations?**
- Track database schema changes.
- Maintain consistent schemas across development environments.
- Reproduce database structure on another machine.
- Apply controlled changes during deployment.
- Maintain migration history.

### Prisma Migration Command

```bash
npx prisma migrate dev --name init
```

This command:
1. Compares the Prisma schema with the current database state.
2. Generates a migration SQL file.
3. Applies the migration.
4. Records the migration in `_prisma_migrations`.

Migration files should be version controlled with application source.

In this project, both migrations are version controlled and verified applied locally. Client generation and live database/schema comparison also passed:

- `20261106100604_init`: initial table, unique indexes, original AVAILABLE/ON_DELIVERY/INACTIVE statuses.
- `20261106114931_add_service_area_and_status`: required service area and ACTIVE/INACTIVE statuses, default ACTIVE.

The second migration warns about removed enum values and adding a required column to a populated table. Schema evolution may require transforming existing data, not just changing model definitions.

For a checkout, run `npx prisma migrate deploy`, then `npx prisma generate`, from `server/`. Use `npx prisma migrate status` to check application state. `migrate dev` creates development migrations; `migrate deploy` applies existing ones without generating the client.

## 2.3 Primary Key

A primary key uniquely identifies each database record.

Our implemented agent ID uses a Prisma-generated UUID string. Its SQL column is TEXT rather than PostgreSQL's native UUID type.

```prisma
id String @id @default(uuid())
```

## 2.4 Unique Constraint

A unique constraint prevents duplicate values in a column.

```prisma
email String @unique
phone String @unique
```

This ensures that two agents cannot have the same email or phone number.

---

# 3. Node.js and Express

## 3.1 Node.js

Node.js is a JavaScript runtime that allows JavaScript code to execute outside the browser.

We use it to run our backend application.

## 3.2 Express.js

Express is a web framework for Node.js.

It helps build HTTP servers and REST APIs through routes and middleware.

Example:

```javascript
app.get("/api/agents", (req, res) => {
  res.json({ message: "Agent list" });
});
```

## 3.3 REST API

REST is an architectural style for designing APIs around resources.

Implemented endpoints (all CRUD operations verified through HTTP against a disposable test database):

| Method | Endpoint | Operation |
|---|---|---|
| POST | /api/agents | Create |
| GET | /api/agents | Retrieve all |
| GET | /api/agents/:id | Retrieve one |
| PATCH | /api/agents/:id | Update |
| DELETE | /api/agents/:id | Delete |

`GET /api/health` returns a process-level running message; it does not query dependencies on each request. List results are ordered by descending `createdAt`. There is no pagination, filtering, or authentication implementation.

## 3.4 Express Middleware (Implemented)

Middleware runs in registration order and can inspect a request, send a response, or pass control with `next()`.

Current order: Helmet, CORS, JSON parsing, Morgan, health/agent routes, unmatched-route handler, centralized error handler. Route-level Zod validation runs before the relevant controller.

- Helmet sets security-related response headers.
- CORS controls browser cross-origin access; default CORS is not authentication.
- `express.json()` parses JSON request bodies.
- Morgan logs HTTP requests in development format.
- Error middleware uses the four-argument `(err, req, res, next)` signature and runs after routes.

Express 5 automatically forwards rejected async handlers to error middleware. The audit exercised a real Prisma connection rejection through an async controller and verified a generic HTTP 500. Malformed JSON returns a generic 400; invalid UUIDs return Zod 400 responses. These checks do not certify every possible parser or transport failure.

## 3.5 Controllers and Services (Implemented)

Routes select the handler. Validation checks inputs. Controllers own HTTP status/response shapes; services own database queries. Services accept data and scalar IDs, not Express request/response objects.

Create calls `agentService.createAgent(req.body)`. Update passes `req.params.id` and `req.body`. This boundary was the fix for the project's reported maximum call stack error caused by passing the full request to Prisma.

## 3.6 HTTP Status Codes (Implemented Contract)

| Code | Current use |
|---|---|
| 200 | Reads, update, delete, health |
| 201 | Agent created |
| 400 | Zod validation failure |
| 400 | Malformed JSON with generic `Invalid JSON body` message |
| 404 | Missing agent or unmatched route |
| 409 | Duplicate email/phone via Prisma P2002 |
| 500 | Unexpected server error with generic client message |

DELETE currently returns 200 with a JSON message, not 204. PATCH accepts a nonempty subset of agent fields; PUT replacement is not implemented. Success/error response shapes and curl examples are in [../README.md](../README.md).

---

# 4. ORM and Prisma

## 4.1 What is an ORM?

ORM stands for Object Relational Mapping.

It allows developers to interact with relational databases using programming-language objects instead of writing SQL for every operation.

Example:

```javascript
const agents = await prisma.deliveryAgent.findMany();
```

Instead of manually writing:

```sql
SELECT * FROM "DeliveryAgent";
```

## 4.2 Prisma

Prisma is an ORM and database toolkit.

Benefits:
- Generated query types and editor assistance; JavaScript application code is not statically type-checked.
- Schema-based data modeling.
- Generated Prisma Client.
- Migration management.

## 4.3 Prisma Schema

The Prisma schema defines database models, fields, data types, and constraints.

Example:

```prisma
model DeliveryAgent {
  id          String      @id @default(uuid())
  name        String
  email       String      @unique
  phone       String      @unique
  serviceArea String
  status      AgentStatus @default(ACTIVE)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}
```

The `AgentStatus` enum contains ACTIVE and INACTIVE. This excerpt reflects the current model, not the historical initial migration.

Important Prisma attributes:

| Attribute | Purpose |
|---|---|
| @id | Primary key |
| @default(uuid()) | Generates UUID |
| @unique | Enforces uniqueness |
| @default(now()) | Sets current timestamp |
| @updatedAt | Automatically updates timestamp |

## 4.4 Prisma Client

Prisma Client is the generated database query client.

Example:

```javascript
const agent = await prisma.deliveryAgent.findUnique({
  where: { id: agentId }
});
```

## 4.5 Prisma Version and Client Generation (Implemented)

Initially the project used Prisma 7.10.1, a PostgreSQL adapter, and a custom generated-client import. Prisma 6.19.3 now provides the simpler standard client workflow used here, resolving the current generation/import configuration mismatch. The precise historical downgrade trigger is not recorded and needs confirmation; this is not a claim that Prisma 7 cannot support JavaScript.

Current implementation:

```javascript
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
export default prisma;
```

The schema uses `prisma-client-js`, and `npx prisma generate` regenerates the client consumed through `@prisma/client`. Legacy ignored TypeScript output in `src/generated/prisma/` is not imported by current code. Match the generator, actual output, import path, and module system when diagnosing client errors. Exact historical error messages were not retained.

## 4.6 Prisma Errors (Implemented Handling)

- P2002: a unique constraint failed. Error middleware returns HTTP 409 with `Email or phone number already exists`. Real duplicate email/phone failures were verified for create and update.
- P2025: an operation required a missing record, such as update/delete. Middleware returns HTTP 404 with `Delivery agent not found`; real missing update/delete targets were verified through HTTP.
- `findUnique` returns `null` for a missing individual lookup. The service explicitly throws a 404 rather than relying on P2025.

Database uniqueness, not the email/phone format schema, prevents duplicates. A pre-check alone would not protect against concurrent insert races.

---

# 5. Docker and Docker Compose

## 5.1 Docker

Docker allows applications and services to run in isolated containers.

We use Docker to run PostgreSQL and Redis.

## 5.2 Docker Compose

Docker Compose allows us to define and manage multiple containers through a YAML configuration file.

Our `compose.yaml` defines:
- PostgreSQL container.
- Redis container.
- Environment variables.
- Port mappings.
- Persistent volumes.

### Important Commands

```bash
docker compose up -d
```

Starts services in detached mode.

```bash
docker compose ps
```

Displays container status.

```bash
docker compose down
```

Stops and removes containers and networks. Named volumes are retained by default.

## 5.3 Docker Volumes

Volumes persist data outside a container's writable filesystem.

This allows PostgreSQL data to survive container recreation.

Compose uses `postgres_data` at `/var/lib/postgresql/data` and `redis_data` at `/data`. `docker compose down` preserves named volumes; `down -v` removes their data and is destructive. A Redis mount does not by itself configure persistence or implement response caching.

PostgreSQL 17 and Redis 7 run in containers with host port mappings 5432 and 6379. The Node.js backend runs on the host; there is no application container or frontend yet.

---

# 6. Redis and Caching

## 6.1 Redis

Redis is an in-memory data store commonly used for caching.

In our application:
- PostgreSQL stores permanent records and remains the source of truth.
- Redis caches list and individual-agent JSON responses with a 60-second TTL.
- Redis is optional for startup and request handling; PostgreSQL is required.

**Sections 6.2-6.5 describe implemented and tested behavior.** Actual Redis list/detail values and TTLs, populated-key invalidation, and complete offline CRUD/recovery workflows passed the live audit. Missed invalidation and concurrent repopulation remain consistency limitations.

## 6.2 Why Caching?

Without caching, repeated read requests may repeatedly query PostgreSQL.

Caching can reduce database load and improve response latency.

## 6.3 Cache-Aside Pattern

Cache-aside is a caching strategy in which the application checks the cache before querying the database.

Flow:

1. Client requests agent data.
2. Backend checks Redis.
3. If cache hit, return cached data.
4. If cache miss, query PostgreSQL.
5. Best-effort store the JSON result in Redis with `EX: 60`.
6. Return the result.

On cache unavailability or a GET/JSON parsing failure, continue to PostgreSQL. SET failures must not change a successful database-read response. Missing agents retain the existing 404 and are not cached as successful records.

## 6.4 Cache Invalidation

After a successful database mutation, cache invalidation is best effort and must not make the mutation fail solely because Redis is down.

Otherwise, users might receive stale data.

Implemented cache keys (unchanged):

- `agents:list`
- `agents:{id}`

TTL is 60 seconds, set on each cache population, not refreshed on hits.

Create invalidates the list; update/delete invalidate the list and affected detail entry in one DEL call. PostgreSQL errors still propagate normally. Failed/skipped invalidation is not retried; existing entries can survive a short outage and remain stale until expiry after reconnect. A concurrent read can also repopulate stale data after invalidation. TTL limits cache lifetime, but is not a strict strong-consistency guarantee.

## 6.5 Graceful Redis Failure Handling

Reusable service helpers check `redis.isReady` and bypass Redis when it is not ready:

- `getCache(key)` catches Redis and JSON parsing errors, logs them, and returns `null` for database fallback.
- `setCache(key, value)` serializes data with the 60-second TTL; errors are logged, not rethrown.
- `invalidateCache(...keys)` deletes the supplied keys; errors are logged, not rethrown.

The installed `redis` client version is 6.3.1. `isOpen` means connection activity is open, including connecting/reconnecting; `isReady` means commands can be served. Startup guards `connect()` with `isOpen`, does not await Redis before listening, and attaches a rejection handler. Explicit retry delays grow from 50 ms to 2 seconds plus up to 199 ms of jitter, including socket timeout failures; `ready` events log initial/recovered connectivity.

Offline queueing is disabled to avoid replaying cache operations after an outage. Client transport settings are a 1-second connection timeout, 2-second socket inactivity timeout, and 1-second idle ping interval. The ping maintains healthy idle connections; a stalled socket can be closed and retried. These are not the TTL or a strict per-request deadline.

PostgreSQL connection failure still prevents startup and retains existing Prisma disconnect/exit handling. No new custom shutdown handler was added. A syntactically valid Redis URL is assumed; cache fallback does not cover invalid client configuration during import.

### Verification Scope

All 74 tests passed in the final full run. Fifty-one tests use the actual backend entrypoint with a disposable PostgreSQL database and empty Redis DB 15, including eight live Docker outage/recovery/startup checks. Six exercise real HTTP middleware/error paths, including a real Prisma connection failure against an unused port. The 17 original fallback tests remain: 16 mocked service/startup checks plus an actual-client silent-socket timeout/retry check. A real second backend process also started and served HTTP health successfully while Redis was already stopped.

From `server/`:

```bash
npm test
RUN_INTEGRATION=1 npm test
DOCKER_HOST=unix:///var/run/docker.sock RUN_INTEGRATION=1 RUN_REDIS_OUTAGE=1 npm test
```

`npm test` now runs the native suite; live integration/outage checks are explicitly opt-in, not fake passes. The full command briefly stops shared development Redis, restores it through cleanup hooks, and never stops PostgreSQL. Its Docker host prefix works in the audited environment; adjust it for other setups. Node.js experimental module mocking is used only where tests say they mock behavior; no package or version was replaced. Follow [../README.md](../README.md#testing) for permissions, isolation, verified results, and limitations.

Test data is isolated in a randomly named database populated by the existing migrations. The harness requires empty Redis DB 15, uses unique records, drops only its own database, deletes only isolated cache entries, and verifies development-record count/digest preservation. Redis was restored and cleanup independently checked. Actual Redis TTLs were inspected, not inferred from mock calls.

---

# 7. Environment Variables

Environment variables store configuration separately from application source code.

Example:

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
```

Access them in Node.js using:

```javascript
process.env.DATABASE_URL
```

We use `dotenv` to load local environment variables.

**Security:** `.env` should not be committed to GitHub because it may contain secrets.

An `.env.example` can contain placeholder configuration and be committed, but this repository's example is currently empty. Copying it alone does not configure the backend. Use the environment table and placeholder URL in [../README.md](../README.md), with local values from [../compose.yaml](../compose.yaml); never publish actual credentials.

The Zod environment module declares PORT, NODE_ENV, DATABASE_URL, and REDIS_URL, but startup does not import it. Dotenv is active; centralized environment validation is not. Startup reads PORT directly with a 5000 default, awaits PostgreSQL, and connects Redis in the background. Run npm/Prisma commands from `server/` for local `.env` loading.

---

# 8. Zod Validation

Zod is a schema validation library.

It validates incoming data before the application processes it.

Example:

```javascript
const agentSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
});
```

It helps reject invalid requests before they reach the database.

The example above introduces the concept; the implemented schemas additionally require `serviceArea`, allow optional ACTIVE/INACTIVE status, trim strings, and reject unknown fields. Names and service areas require two characters; phone requires ten characters, not digits-only validation. Email is not normalized to lowercase.

Create requires all four main fields. Update uses `.partial()` and rejects an empty object. IDs use UUID validation on route parameters. `safeParse` failures return HTTP 400 with field/message entries; successful parsed data is assigned back to the selected request source. Valid and invalid parameterized paths were exercised through HTTP. Each single-field update and a multi-field update persisted correctly and advanced `updatedAt`.

---

# 9. Git and GitHub

## 9.1 Git

Git is a distributed version control system used to track source-code changes.

## 9.2 Important Commands

```bash
git init
```

Initializes a Git repository.

```bash
git add .
```

Stages changes.

```bash
git commit -m "message"
```

Creates a commit.

```bash
git push
```

Uploads commits to a remote repository.

```bash
git status
```

Displays repository status.

## 9.3 .gitignore

`.gitignore` specifies files and directories that Git should not track.

Examples:
- node_modules/
- .env
- dist/
- build/

---

# 10. Project Implementation History

## Completed

- Initialized Git repository.
- Created project documentation.
- Configured Node.js dependencies.
- Configured Docker Compose.
- Initialized Prisma 7.10.1 historically, then moved to 6.19.3.
- Generated Prisma Client.
- Applied both database migrations (reported).
- Replaced historical adapter/custom import with standard Prisma Client.
- Created Redis client configuration.
- Wrote environment-validation module (not wired into startup).
- Implemented Express startup, middleware, and health response.
- Implemented CRUD routes, controllers, services, and Zod validation.
- Implemented centralized Prisma error mappings.
- Reported successful startup/connections, create/list, and duplicate-phone checks.
- Implemented optional Redis cache-aside reads, 60-second TTL, and best-effort invalidation.
- Implemented graceful Redis fallback with nonblocking startup and passed 17 focused tests (16 mocked, one actual-client transport check).
- Passed the complete 74-test audit, including real HTTP CRUD, actual cache values/TTL/invalidation, Redis-absent startup, and Docker Redis stop/restart recovery.
- Fixed malformed JSON responses to avoid echoing submitted input; verified async database failures return generic 500.
- Verified Prisma generation, both applied migrations, live schema alignment, Compose health, and safe test-data cleanup.

## Pending

- Populate empty environment example and wire configuration validation.
- Verify PostgreSQL restart persistence when stopping it is permitted; it stayed running during this audit.
- Extend tests for concurrency/load and stronger cache consistency if required.
- Build React frontend.
- Perform integration testing.
- Complete deployment documentation.

---

# 11. Interview Questions to Prepare

1. What is Node.js?
2. What is Express.js?
3. What is an ORM?
4. What is Prisma?
5. What is a database migration?
6. Why did we choose PostgreSQL?
7. What is Docker?
8. What is Docker Compose?
9. What is Redis?
10. What is caching?
11. What is the cache-aside pattern?
12. What is cache invalidation?
13. What is a REST API?
14. What is the difference between PUT and PATCH?
15. What is a primary key?
16. What is a unique constraint?
17. Why do we use environment variables?
18. What is Zod?
19. What is Git?
20. How does our application architecture work?

---

# 12. Interview Preparation Notes

For every new concept or implementation:

- Explain what it is.
- Explain why we need it.
- Document how we implemented it.
- Include a practical example.
- Record important interview questions.
- Record mistakes and debugging lessons.

**Final goal:** Be able to explain the entire project, justify technical decisions, and answer questions about every major implementation.

---

# 13. Actual Debugging Lessons

## 13.1 Maximum Call Stack Error

**Reported cause:** The full Express request object was incorrectly passed to Prisma instead of request body data. Request objects contain complex and circular references, not just record fields.

**Resolution:** Controllers pass `req.body` for create and an ID plus `req.body` for update. The fix is the data boundary, not switching ORM versions or changing Redis. Inspect arguments at the controller-service and service-Prisma boundaries before blaming a dependency.

## 13.2 Prisma Generation and Imports

The earlier setup expected a JavaScript import under a custom generated directory whose output contains TypeScript. Align generator output and import paths with the runtime. The current project uses Prisma 6.19.3, `prisma-client-js`, and `@prisma/client`; the old adapter/custom-output approach is historical. Exact original error messages need confirmation rather than reconstruction.

## 13.3 Implementation Is Not Verification

An implemented handler and error mapping are not proof that a complete request succeeds. Earlier evidence covered create/list and duplicate phone only; this audit now verifies update/delete and the full HTTP middleware path as well. Test parsed parameter assignment and persisted values, not just isolated service logic.

Likewise, a connected Redis client alone is not a cache, a volume is not a persistence policy, and a written environment schema is not active unless imported. Live Redis outage/recovery is now observed, but passing mocks alone would not establish it, and named-volume configuration does not prove restart persistence.

## 13.4 Catching Redis Errors Is Not Enough

The existing helpers were initially unused: services directly awaited Redis calls, and startup awaited a potentially retrying connection. Routing commands through guarded helpers fixes error propagation. Checking `isReady`, disabling the offline queue, and bounding stalled sockets address unavailable clients instead of leaving API requests queued behind reconnection. Starting Redis in the background with a rejection handler prevents both blocked HTTP startup and unhandled connection rejections.

An actual-client check exposed another version-specific detail: Redis 6.3.1's default reconnect policy stops on socket timeout. An explicit jittered retry strategy was required so the added timeout detects outages without permanently disabling cache recovery. Verify defaults against installed code and runtime behavior, not just mocks.

## 13.5 Malformed JSON Can Expose Submitted Input

The audit sent invalid JSON through HTTP and observed raw submitted text in the parser's message. The centralized handler had returned `err.message` for a 400 error. It now handles `entity.parse.failed` separately with `Invalid JSON body`, without logging that parser object. A real HTTP regression verifies the exact generic response. Other unexpected errors still return `Internal server error`.

## 13.6 Test Harness Assumptions Can Produce False Failures

The first broad integration run had seven failed assertions and seven cancelled outage cases, not seven demonstrated application bugs. Redis 6.3.1's multi-key EXISTS takes an array; passing multiple arguments checked only one key. Node `pg` interprets timezone-less timestamps locally, while Prisma timestamps are treated as UTC. The harness now compares them with explicit SQL `AT TIME ZONE 'UTC'`. After those corrections the 73-test run passed; an additional live Redis-absent startup check brought the final passing suite to 74 tests.

# 14. Practical Interview Questions and Answers

### Why PostgreSQL rather than storing records in Redis?

PostgreSQL is the durable source of truth with relational constraints and transactions. Redis now provides optional cached read responses with 60-second expiry. All mutations go to PostgreSQL first, regardless of cache availability.

### Why JavaScript instead of TypeScript?

The backend uses ES modules and runs directly in Node.js without a compilation step, keeping assignment scope small. Zod validates runtime input, but application-wide compile-time type checking is not present.

### Why are you using Prisma 6.19.3 rather than 7.10.1?

Version 6 supports the current standard package import and simpler schema configuration, avoiding the earlier adapter/custom-output complexity. That is the current technical rationale; the precise historical downgrade trigger still needs confirmation. This project choice does not imply Prisma 7 is generally incompatible with JavaScript.

### How does a create request flow through the application?

Express parses JSON; the router applies Zod validation; the controller passes parsed body data to a service; the service creates the record through Prisma/PostgreSQL; the controller returns 201 with the agent. Rejected async operations reach centralized error middleware.

### Why separate controllers from services?

Controllers own HTTP behavior; services own persistence and can be exercised independently of Express. Passing the entire request to Prisma violated this boundary and caused the reported stack overflow.

### How do you prevent duplicate agents?

Email and phone have database unique constraints. Zod validates input shape/format, not uniqueness. Real Prisma P2002 errors were verified as HTTP 409 for both email and phone conflicts on create/update.

### How do you handle nonexistent records?

Individual `findUnique` results are checked for null and produce an explicit 404. Update/delete produce P2025 for missing targets, mapped to 404. Those responses and invalid UUID 400 errors passed actual HTTP tests.

### Why PATCH rather than PUT, and why not 204 for delete?

PATCH permits a nonempty partial update; PUT would represent replacement semantics. The implemented delete contract returns 200 with a JSON success message. A 204 design would require an empty response, but it is not this API's behavior.

### What do middleware order and Express 5 change?

JSON parsing precedes body validation, and error handling follows routes. Express 5 forwards rejected async handlers automatically. The audit verified parameter validation, malformed-JSON errors, and an actual Prisma connection rejection through the full HTTP path.

### What happens if Redis is unavailable?

Startup does not await Redis before listening, but still requires PostgreSQL. Read helpers fall back to PostgreSQL; cache writes/invalidation failures are logged without failing valid CRUD operations. Background reconnection restores cache use when the client is ready. Retained stale keys may remain until expiry because invalidation is best effort.

### How do you invalidate the cache?

List/detail JSON values have 60-second TTLs. After successful create invalidate the list; after update/delete invalidate the list and affected detail key. Actual populated keys and subsequent fresh responses were verified. Strong consistency under concurrent cache repopulation or missed invalidation is not guaranteed.

### How do migrations differ from client generation?

Migrations change the database and record schema history. Generation produces the query client from the Prisma schema. A checkout uses `migrate deploy` and a separate `generate`; development schema changes use `migrate dev` with reviewed SQL.

### Will recreating the containers erase the database?

Not while the named PostgreSQL volume is retained. Compose down retains it; down with volume removal deletes data. Redis's data mount does not guarantee a configured persistence policy.

### What would you verify next?

PostgreSQL restart persistence, concurrency/load behavior, and startup environment-validation integration remain. CRUD, validation, actual cache TTL/invalidation, Redis-absent startup, and live Redis outage/recovery passed. `npm test` runs the native suite; flags explicitly enable integration and disruptive outage cases. React is still outside the implemented backend.

### What should you avoid claiming in an interview?

Do not claim a React interface, active centralized environment validation, PostgreSQL restart persistence, or production readiness. You can cite the 74-test audit and observed live CRUD/Redis recovery, explaining disposable-data isolation and remaining cache-consistency limitations.