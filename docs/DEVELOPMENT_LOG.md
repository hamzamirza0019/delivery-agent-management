# Development Log

## 2026-11-06

Entries follow the known implementation sequence, not invented timestamps. Git history confirms the initial Prisma 7.10.1 setup; current source and lockfile confirm 6.19.3. Migration application, runtime tests, and debugging history are reported milestone evidence, not rerun results from this documentation update.

### Project Initialization
- [x] Created project directory.
- [x] Initialized Git repository.
- [x] Created main branch.
- [x] Created documentation directory.
- [x] Configured root .gitignore.

### Initial Backend Setup
- [x] Initialized Node.js backend.
- [x] Installed Express and required dependencies.
- [x] Configured ES modules.
- [x] Installed Prisma 7.10.1 initially.
- [x] Initialized Prisma configuration.
- [x] Configured PostgreSQL adapter.
- [x] Generated Prisma Client.
- [x] Created initial DeliveryAgent migration.

### Infrastructure
- [x] Created Docker Compose configuration.
- [x] Configured PostgreSQL container.
- [x] Configured Redis container.
- [x] Started database infrastructure.

### Configuration
- [x] Created environment configuration.
- [x] Created Zod environment-validation module; it is not currently imported by startup.
- [x] Created Prisma database connection module.
- [x] Created Redis connection module.

### Initial Database Migration

- Created `20261106100604_init`, reported successfully applied.
- Defined DeliveryAgent with unique email and phone fields and timestamps.
- The historical status enum contained AVAILABLE, ON_DELIVERY, and INACTIVE, with AVAILABLE as the default. `serviceArea` was not yet present.

### Prisma Client Generation and Version Change

- Initial configuration used Prisma 7.10.1, `@prisma/adapter-pg`, a separate Prisma configuration file, and an import from `src/generated/prisma/client.js`.
- Client generation/import issues arose while aligning generated output with the JavaScript ES module backend. The legacy generated directory contains TypeScript files; relying on a `.js` import there did not match that output layout.
- The project moved to Prisma 6.19.3. The current technical rationale is the simpler `prisma-client-js` generation and standard package import for this JavaScript backend, avoiding the earlier adapter/custom-output configuration complexity. The exact historical trigger for the downgrade is not recorded and needs confirmation; this rationale describes the current configuration's fit, not a claim that Prisma 7 cannot be used with JavaScript.
- Current `prisma` and `@prisma/client` declarations are `^6.19.3`; both resolve to 6.19.3 in the lockfile. The adapter dependency and former Prisma 7 configuration are no longer in the current setup.
- The datasource URL is now declared in the Prisma schema. The database module imports `PrismaClient` from `@prisma/client` and constructs it without a driver adapter.
- Generate the client with `npx prisma generate` from `server/` after installation or schema changes. The ignored legacy generated directory is not the active client import.

Exact original generation-error messages and a full command transcript are not retained in the repository. The before/after configuration is inspectable; the detailed error transcript and precise downgrade motivation remain confirmation items.

### Service Area and Status Migration

- Created and reportedly applied `20261106114931_add_service_area_and_status`.
- Added required `serviceArea` and changed AgentStatus to ACTIVE/INACTIVE, default ACTIVE.
- Current model: UUID string ID, name, unique email, unique phone, service area, status, creation timestamp, and Prisma-maintained update timestamp.
- Migration warnings matter for existing data: removed enum values cannot be directly cast, and the new required column has no default. Do not assume this migration safely upgrades an older populated database without a reviewed data transformation.

### Express Startup and CRUD Implementation

- Added separate application and startup modules with default port 5000.
- Startup connects PostgreSQL, then Redis, before listening; connection/startup success is reported.
- Configured Helmet, CORS, JSON parsing, and Morgan.
- Added `/api/health` and `/api/agents` routes for create, list, individual retrieval, PATCH update, and delete.
- Controllers pass request body data and ID strings to services; services use Prisma Client for persistence. List queries order by newest creation timestamp.
- Added strict Zod body validation, nonempty partial updates, and UUID parameter validation.
- Added validation 400 responses, unmatched-route 404 responses, centralized P2002-to-409 and P2025-to-404 mappings, explicit missing-lookup 404, and generic unexpected-error 500 responses.

### Debugging: Maximum Call Stack Error

The actual reported cause was an Express request object being passed to Prisma instead of request body data. Express requests contain complex references, including circular object relationships; they are not database input objects. The error was not caused by Redis caching, and changing Prisma versions was not the root-cause fix for this bug.

The resolution was to preserve the controller-service boundary: create uses `agentService.createAgent(req.body)`; update passes `req.params.id` and `req.body`. Services receive record data or scalar IDs, never the entire request object. Validation supplies parsed body data before the controller runs.

Debugging lesson: inspect the actual argument crossing each layer before attributing recursive traversal errors to the ORM or changing dependencies.

### Reported Successful Checks

- Express server starts on port 5000.
- PostgreSQL and Redis connections succeed.
- Both migrations are applied.
- Agent creation succeeds.
- Agent listing succeeds.
- A duplicate phone number is rejected through the unique-constraint conflict handling.

Update and delete have been implemented but have **not** been verified as successful. Individual retrieval, broader validation cases, duplicate-email conflicts, and missing-record responses also lack recorded verification. No automated test suite exists; `npm test` remains a deliberately failing placeholder.

### Current Status
- Backend CRUD, validation, and error handling implemented.
- Both database migrations reportedly applied.
- Redis connected, but agent services still query PostgreSQL directly.
- Frontend not yet initialized.
- Redis caching not yet implemented.

### Current Blockers and Verification Gaps

- Parameterized endpoints, especially update/delete, need runtime verification before completion can be claimed.
- `server/.env.example` is empty; copying it does not supply usable configuration.
- The Zod environment module exists but startup reads `process.env` directly instead of importing it.
- There are no automated API or integration tests.
- No separate blocking infrastructure failure is reported; caching and frontend work have not started.

### Next Tasks
- [ ] Verify individual retrieval, update, delete, UUID validation, and missing-record behavior.
- [ ] Test invalid bodies, duplicate email, and parser errors; add an automated suite.
- [ ] Populate the environment example and wire startup environment validation in a future application change.
- [ ] Implement Redis caching and invalidation.
- [ ] Verify TTL, cache hits/misses, and consistency after writes.
- [ ] Build frontend.
- [ ] Complete integration and documentation.