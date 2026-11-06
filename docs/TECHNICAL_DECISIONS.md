# Technical Decisions

Status reflects repository inspection at the 2026-11-06 milestone. A selected technology is not necessarily an implemented feature. Runtime successes are reported milestone results; update/delete verification is still pending.

## 1. Backend: Node.js + Express

**Implemented decision:** Use Node.js with Express 5 and JavaScript ES modules (`"type": "module"`).

**Reason:**
- Lightweight backend framework.
- Supports REST API development.
- Middleware-based architecture.
- Large ecosystem.

JavaScript keeps the backend small and directly executable without a TypeScript compiler/build step. This favors assignment delivery and a single-language development workflow. It sacrifices compile-time application type checking; Zod and database constraints provide runtime safeguards but are not replacements for TypeScript. A later TypeScript migration is not a current deliverable.

The app configures Helmet, default CORS, JSON parsing, and Morgan. These are middleware choices, not a complete production security design. Express 5 forwards rejected async route/controller promises to centralized error handling.

## 2. Database: PostgreSQL

**Implemented decision:** Use PostgreSQL for persistent storage, provided locally by `postgres:17-alpine` in Docker Compose.

**Reason:**
- Relational database suited to structured agent records.
- Supports unique constraints.
- Provides transactions and data integrity.
- Reliable persistent storage.

The current model is structured agent data with unique email/phone constraints. PostgreSQL enforces those constraints even when concurrent requests bypass a preliminary application check. Transactions are supported by the database, but the project has not implemented a multi-operation business transaction workflow.

## 3. ORM: Prisma 6.19.3

**Implemented decision:** Use Prisma Client and CLI 6.19.3 as resolved in the lockfile (dependency declarations use `^6.19.3`).

**Reason:**
- Generated query API and editor assistance; the JavaScript app itself is not statically type-checked.
- Schema-based data modeling.
- Database migration management.
- Generated Prisma Client.

The project initially used 7.10.1 with a PostgreSQL driver adapter and custom generated-client import. The current Prisma 6 workflow simplifies generation/import alignment for JavaScript ES modules: `prisma-client-js`, datasource URL in the schema, and `import { PrismaClient } from "@prisma/client"`. No adapter is used by the current database module. This explains the current technical fit; the exact historical downgrade trigger needs confirmation. It is not a blanket incompatibility claim about Prisma 7.

The two migrations are `init` and `add_service_area_and_status`; both are reportedly applied. The latter changes the original status enum and adds a required field, with explicit warnings for existing data. Existing migration history must not be rewritten to hide those transitions.

Prisma Client performs create/findMany/findUnique/update/delete operations. P2002 maps to HTTP 409 for email/phone conflicts; P2025 maps to HTTP 404 for missing update/delete targets. Individual lookup uses `findUnique` and an explicit not-found check rather than relying on P2025.

## 4. Caching: Redis

**Selected decision:** Use Redis for caching frequently accessed API responses.

**Implemented now:** A Redis client and startup connection, with connection success reported. Redis runs as `redis:7-alpine`. Services contain no cache reads/writes or invalidation. Currently the backend requires the initial Redis connection before listening; database-only startup fallback is not implemented.

**Planned caching strategy:**
- Cache the delivery agent list.
- Cache individual agent details.
- Use cache-aside pattern.
- Apply a configurable TTL.
- Invalidate affected cache entries after create, update, and delete operations.

**Planned cache keys:**
- agents:list
- agents:{id}

These keys are proposals, not existing keys produced by the API. Planned reads check Redis, return a hit, otherwise query PostgreSQL and store a serialized result with a TTL. PostgreSQL remains the source of truth.

Planned write handling: invalidate the list after create; invalidate the list and affected detail entry after update/delete. TTL, serialization, cache-outage fallback, and protection against concurrent stale repopulation still need decisions and tests. No cache-consistency or performance benefit is claimed yet.

## 5. Frontend: React + Vite

**Planned decision:** Use React with Vite. `client/` is empty; there is no frontend package, UI, or API integration.

**Reason:**
- Component-based UI development.
- Fast development server.
- Suitable for building an agent management dashboard.

## 6. Infrastructure: Docker Compose

**Implemented decision:** Run PostgreSQL and Redis using Docker Compose, exposing host ports 5432 and 6379.

**Reason:**
- Reproducible development environment.
- Isolated infrastructure services.
- Simplified service startup and management.

The Node.js backend runs directly on the Linux host. The planned frontend will also run on the host during development; neither application has a Compose service.

Named volumes preserve PostgreSQL data across container recreation and provide Redis a data mount. `docker compose down` retains them; `down -v` deletes them. A mount does not by itself configure Redis persistence. The existing hardcoded local database configuration is not production secret management; documentation uses credential placeholders.

## 7. Validation: Zod

**Implemented decision:** Use Zod for request validation before controllers execute.

**Reason:**
- Schema-based validation.
- Clear validation errors.
- Reusable validation schemas.

Create/update body schemas reject unknown fields and trim strings. PATCH allows a nonempty partial body. Phone validation is a minimum character count, not full telephone-format validation. UUID parameter schemas exist; parameterized route behavior still requires verification.

A separate Zod environment schema has been written but is not wired into startup. Dotenv currently loads local configuration, while startup/database/Redis read environment variables directly. The empty environment example and missing validation integration remain follow-up application work.

## 8. Version Control: Git

**Implemented decision:** Use Git; repository initialization and `main` are confirmed. GitHub remains the planned repository submission channel; publication/accessibility is not established by this milestone.

**Reason:**
- Track development history.
- Maintain versioned source code.
- Enable repository-based project submission.

## 9. Layered Architecture and HTTP Contract

**Implemented decision:** Separate routing, validation, HTTP handling, and persistence.

| Layer | Responsibility in current code |
|---|---|
| Application middleware | Helmet, CORS, JSON body parsing, Morgan |
| Routes | Map HTTP methods/paths to validation and controllers |
| Validation middleware | Parse request data with Zod; return structured 400 errors |
| Controllers | Pass body data/ID strings to services and build HTTP responses |
| Services | Query Prisma and explicitly handle a missing individual lookup |
| Database configuration | Export a shared Prisma Client instance |
| Error middleware | Map Prisma errors and return centralized JSON failures |

This separation prevents HTTP request objects from becoming Prisma input, the root cause of the reported maximum call stack error. Create receives `req.body`; update receives an ID and `req.body`, not `req`.

The resource API uses POST, GET, PATCH, and DELETE. PATCH models partial updates rather than PUT replacement. Create returns 201, other CRUD successes 200 (including delete), validation 400, missing resources/routes 404, unique conflicts 409, and unexpected errors 500. These are implemented contracts; update/delete runtime success remains unverified.

## 10. Verification and Operational Boundaries

Reported successful checks cover startup/connections, migrations, create/list, and duplicate phone. Broader endpoint testing and an automated suite are pending; `npm test` is a failing placeholder. The health response is not a live dependency readiness check. Authentication, pagination, filtering, production deployment, and Redis caching are not implemented.