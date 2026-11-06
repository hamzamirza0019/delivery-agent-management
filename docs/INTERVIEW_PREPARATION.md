# Interview Preparation Notebook
## Delivery Agent Management System

This document tracks the technical concepts, implementation details, architectural decisions, and problems encountered while developing this project.

**Purpose:** Use this document for technical interview preparation and project explanation.

**Milestone: 2026-11-06.** Backend CRUD, middleware, request validation, and centralized errors are implemented. Startup, connections, migrations, create/list, and duplicate-phone rejection have reported successful checks, not reruns in this documentation update. Individual retrieval and update/delete still need verification. Redis caching and React remain planned.

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
| Caching | Redis connection implemented; caching planned |
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

In this project, migrations are intended to be version controlled; the second migration is currently untracked in the working tree and still needs the user's Git review. Both are reported applied locally:

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

Implemented endpoints (individual retrieval, update, and delete verification pending):

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

Express 5 automatically forwards rejected async handlers to error middleware. This does not guarantee that every error has the right HTTP mapping; parser and parameterized-route behavior still need tests.

## 3.5 Controllers and Services (Implemented)

Routes select the handler. Validation checks inputs. Controllers own HTTP status/response shapes; services own database queries. Services accept data and scalar IDs, not Express request/response objects.

Create calls `agentService.createAgent(req.body)`. Update passes `req.params.id` and `req.body`. This boundary was the fix for the project's reported maximum call stack error caused by passing the full request to Prisma.

## 3.6 HTTP Status Codes (Implemented Contract)

| Code | Current use |
|---|---|
| 200 | Reads, update, delete, health |
| 201 | Agent created |
| 400 | Zod validation failure |
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

- P2002: a unique constraint failed. Error middleware returns HTTP 409 with `Email or phone number already exists`. Duplicate phone rejection has a reported successful test; duplicate email still needs verification.
- P2025: an operation required a missing record, such as update/delete. Middleware returns HTTP 404 with `Delivery agent not found`; endpoint verification is pending.
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
- PostgreSQL stores permanent records.
- Redis connects at startup, but does not yet store API response caches.

**Sections 6.2-6.4 describe planned concepts, not implemented behavior.** Agent services currently query PostgreSQL directly. Startup requires an initial Redis connection; fallback when Redis is unavailable has not been implemented.

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
5. Store the result in Redis.
6. Return the result.

## 6.4 Cache Invalidation

When caching is implemented, an agent create/update/delete must invalidate or refresh affected cached data.

Otherwise, users might receive stale data.

Planned cache keys:

- `agents:list`
- `agents:{id}`

The actual TTL and invalidation implementation will be documented after development.

Planned invalidation: create clears the list; update/delete clear the list and the affected detail entry. Cache outage behavior and concurrent stale repopulation still need a design and tests.

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

The Zod environment module declares PORT, NODE_ENV, DATABASE_URL, and REDIS_URL, but startup does not import it. Dotenv is active; centralized environment validation is not. Startup reads PORT directly with a 5000 default and connects both services before listening. Run npm/Prisma commands from `server/` for local `.env` loading.

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

Create requires all four main fields. Update uses `.partial()` and rejects an empty object. IDs use UUID validation on route parameters. `safeParse` failures return HTTP 400 with field/message entries; successful parsed data is assigned back to the selected request source. Parameterized routes still need compatibility/runtime checks.

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

## Pending

- Verify individual retrieval, update, delete, and parameter handling.
- Verify invalid requests, duplicate email, and missing records.
- Populate empty environment example and wire configuration validation.
- Add automated tests; current `npm test` is a failing placeholder.
- Implement Redis caching and invalidation.
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

An implemented handler and error mapping are not proof that a complete request succeeds. Create/list and duplicate phone have reported passing checks; update/delete have not. Test the full middleware path as well as the database operation, including parsed parameter assignment, not just isolated service logic.

Likewise, a connected Redis client is not a cache, a volume is not a persistence policy, and a written environment schema is not active unless imported.

# 14. Practical Interview Questions and Answers

### Why PostgreSQL rather than storing records in Redis?

PostgreSQL is the durable source of truth with relational constraints and transactions. Redis is selected for a future read cache; no response caching exists yet.

### Why JavaScript instead of TypeScript?

The backend uses ES modules and runs directly in Node.js without a compilation step, keeping assignment scope small. Zod validates runtime input, but application-wide compile-time type checking is not present.

### Why are you using Prisma 6.19.3 rather than 7.10.1?

Version 6 supports the current standard package import and simpler schema configuration, avoiding the earlier adapter/custom-output complexity. That is the current technical rationale; the precise historical downgrade trigger still needs confirmation. This project choice does not imply Prisma 7 is generally incompatible with JavaScript.

### How does a create request flow through the application?

Express parses JSON; the router applies Zod validation; the controller passes parsed body data to a service; the service creates the record through Prisma/PostgreSQL; the controller returns 201 with the agent. Rejected async operations reach centralized error middleware.

### Why separate controllers from services?

Controllers own HTTP behavior; services own persistence and can be exercised independently of Express. Passing the entire request to Prisma violated this boundary and caused the reported stack overflow.

### How do you prevent duplicate agents?

Email and phone have database unique constraints. Zod validates input shape/format, not uniqueness. Prisma P2002 is mapped to 409. The duplicate-phone path has a reported successful test; duplicate-email verification is pending.

### How do you handle nonexistent records?

Individual `findUnique` results are checked for null and produce an explicit 404. Update/delete can produce P2025, mapped to 404. Those parameterized endpoint paths still need runtime verification.

### Why PATCH rather than PUT, and why not 204 for delete?

PATCH permits a nonempty partial update; PUT would represent replacement semantics. The implemented delete contract returns 200 with a JSON success message. A 204 design would require an empty response, but it is not this API's behavior.

### What do middleware order and Express 5 change?

JSON parsing must precede body validation, and error handling follows the routes. Express 5 forwards rejected async handlers automatically. Runtime compatibility, including handling of request properties in validation middleware, still needs full-path testing.

### What happens if Redis is unavailable?

The current startup awaits Redis before listening, so an initial connection failure prevents startup. There is no cache fallback implementation. Future cache-aside outage behavior needs an explicit decision.

### How would you invalidate the planned cache?

Cache list/detail reads with TTL. After successful create invalidate the list; after update/delete invalidate the list and the affected detail key. Test consistency and concurrent stale repopulation. These are plans, not current service behavior.

### How do migrations differ from client generation?

Migrations change the database and record schema history. Generation produces the query client from the Prisma schema. A checkout uses `migrate deploy` and a separate `generate`; development schema changes use `migrate dev` with reviewed SQL.

### Will recreating the containers erase the database?

Not while the named PostgreSQL volume is retained. Compose down retains it; down with volume removal deletes data. Redis's data mount does not guarantee a configured persistence policy.

### What would you verify next?

Individual retrieval, update/delete, UUID and invalid-body handling, duplicate email, and missing records. Then add automated tests, integrate environment validation, implement Redis caching, and build React. The existing npm test command does not run tests.

### What should you avoid claiming in an interview?

Do not claim a React interface, working Redis response caching, passed update/delete tests, active environment validation, or production readiness. Explain implemented code, reported evidence, and remaining verification separately.