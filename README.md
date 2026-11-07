# Delivery Agent Management System

Agent Hub by Aone Tech manages delivery agents through the existing React interface and REST API. Individual accounts authenticate with bcrypt passwords and expiring Bearer JWTs. PostgreSQL remains the persistent source of truth; CRUD, global search, the dashboard design, and optional Redis caching are preserved.

The 2026-11-06 backend audit passed all 74 automated tests: 51 real HTTP/database/cache integration tests, six HTTP middleware/error checks, and 17 existing fallback regression tests. Live CRUD, Redis outage fallback, startup with Redis absent, and automatic recovery were observed against disposable test data. PostgreSQL container-restart persistence was not tested because PostgreSQL was kept running throughout the audit; production readiness is not claimed.

The 2026-11-07 authentication update passed 98 tests, retaining the previous cases and adding registration/login, ownership, cache isolation, and safe legacy assignment. The frontend production build and live browser auth/account-switching checks passed. The two pre-existing agents were preserved without assigning them to an arbitrary account.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React + Vite, JavaScript; existing dashboard/CRUD/search with Login/Register |
| Backend | Node.js + Express 5, JavaScript ES modules |
| Database | PostgreSQL |
| ORM | Prisma Client and CLI 6.19.3 in the lockfile |
| Cache | Redis 6.3.1 npm client; optional cache-aside reads with 60-second TTL |
| Validation | Zod |
| Authentication | bcrypt 6.0.0 and jsonwebtoken 9.0.3; no existing dependency upgrades |
| Infrastructure | Docker Compose |
| Version control | Git; current branch is `main` |

The dependency declarations use `^6.19.3` for Prisma. The Compose images are `postgres:17-alpine` and `redis:7-alpine`.

## Architecture

```text
HTTP request -> Express middleware -> Bearer authentication -> agent router -> Zod validation
						 -> controller -> service -> Prisma Client -> PostgreSQL
HTTP errors  -> centralized error middleware -> JSON response

Server startup -> required PostgreSQL connection -> listen
			   -> optional Redis connection/reconnection in background
React frontend -> authenticated API
Read services  -> Redis cache hit, or PostgreSQL fallback -> best-effort cache write
```

Helmet, default CORS, JSON parsing, and Morgan are configured in the application. Controllers handle HTTP responses; services perform database operations and best-effort cache access. Express 5 forwards rejected async handlers to error middleware. Redis failures are handled inside cache helpers rather than failing valid requests. Docker Compose runs the databases only; the backend runs on the host.

## Implementation Status

| Feature | Status |
|---|---|
| Git initialization and `main` branch | Complete |
| PostgreSQL/Redis infrastructure and connections | Configured; PostgreSQL required, Redis optional |
| User/DeliveryAgent schema and three migrations | Applied and validated; no live schema drift; legacy agents preserved |
| Create and list endpoints | Verified through HTTP against a disposable PostgreSQL database |
| Duplicate email/phone conflicts | Verified HTTP 409 using real unique-constraint failures |
| Individual retrieval, update, delete | Verified through HTTP, including persistence and missing records |
| Zod validation and centralized errors | Verified 400/404/409/500; malformed JSON no longer echoes input |
| Health endpoint and unmatched-route response | Verified HTTP 200/404; Helmet/CORS headers checked |
| Environment-validation module | Active; JWT_SECRET required, JWT expiry validated |
| Redis response caching, TTL, invalidation | Verified against Redis 7, including Docker stop/restart and automatic recovery |
| React + Vite frontend | Existing interface preserved; protected routes, auth forms, logout and user labels verified |
| Authentication/ownership | Verified registration/login/me, 401 rejection, foreign-agent 404 and user-specific caches |
| Automated tests | Full auth suite: 98 passed, zero failed/cancelled/skipped; default suite: 29 passed |

## Project Structure

```text
delivery-agent-management/
|-- client/                         # Existing React UI; auth forms in src/AuthPage.jsx
|-- server/
|   |-- package.json
|   |-- package-lock.json
|   |-- .env.example                # Placeholders only; JWT_SECRET intentionally blank
|   |-- scripts/assign-legacy-agents.js
|   |-- test/
|   |   |-- redis-fallback.test.js
|   |   |-- http-middleware.test.js
|   |   |-- auth.test.js
|   |   |-- setup.js
|   |   `-- backend.integration.test.js
|   |-- prisma/
|   |   |-- schema.prisma
|   |   `-- migrations/
|   `-- src/
|       |-- app.js
|       |-- server.js
|       |-- config/                 # Database, Redis, environment schema
|       |-- routes/
|       |-- middleware/
|       |-- controllers/
|       |-- services/
|       |-- validators/
|       |-- utils/                  # No authored utilities yet
|       `-- generated/prisma/       # Ignored legacy output; not current import
|-- docs/
|   |-- PROJECT_PLAN.md
|   |-- DEVELOPMENT_LOG.md
|   |-- TECHNICAL_DECISIONS.md
|   `-- INTERVIEW_PREPARATION.md
|-- compose.yaml
`-- README.md
```

Current Prisma generation uses `prisma-client-js` and the backend imports from `@prisma/client`, not the legacy generated TypeScript directory.

## Prerequisites

- Node.js 22 LTS recommended; the inspection environment uses 22.23.2. Current Redis dependencies require Node.js 20 or newer.
- npm (inspection environment: 10.9.8), Git, Docker Engine, and the Docker Compose v2 plugin.
- Available host ports 5432, 6379, and 5000, unless configuration is deliberately adjusted.
- A local repository checkout. There is no root npm package; install/run each package from its own directory.

## Installation and Environment

From the repository root:

```bash
docker compose up -d
docker compose ps
cd server
npm ci
cp -n .env.example .env
```

The copy command preserves an existing local `.env`. Populate database values and a stable signing secret in `server/.env`; JWT_SECRET is deliberately blank in the example. The following values are placeholders, not usable credentials:

```dotenv
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@localhost:5432/<POSTGRES_DB>?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=<cryptographically-random-secret-at-least-32-characters>
JWT_EXPIRES_IN=1h
```

Replace database placeholders with the values configured in [compose.yaml](compose.yaml). URL-encode special characters in connection credentials. Do not commit `.env` or share actual credentials. The Compose file currently contains fixed local development database credentials; this is not a production secret-management setup.

| Variable | Current use |
|---|---|
| `PORT` | Validated configuration used by startup; defaults to 5000 |
| `DATABASE_URL` | PostgreSQL connection URL declared in the Prisma datasource |
| `REDIS_URL` | Passed to the Redis client; set it explicitly for this setup |
| `NODE_ENV` | Declared in the environment schema; no custom runtime behavior currently uses it |
| `JWT_SECRET` | Required private signing secret, at least 32 characters; use a cryptographically random value |
| `JWT_EXPIRES_IN` | Positive duration such as `1h`, `30m`, or `1d`; defaults to `1h` |

[server/src/config/env.js](server/src/config/env.js) now validates runtime configuration, including the required JWT secret. Do not use the literal placeholder as a signing key. Keep a stable secret in the private environment/secret manager so restarting does not invalidate every token. The local verification server was started with a generated in-memory secret; the existing `.env` was not edited. Run backend and Prisma commands from `server/` so dotenv finds the local `.env` file. The frontend never receives JWT_SECRET.

## Database Setup and Migrations

For a fresh checkout, apply the existing migrations and generate the current client from `server/`:

```bash
npx prisma migrate deploy
npx prisma generate
npx prisma migrate status
```

`migrate deploy` applies checked-in migrations; it does not generate Prisma Client. For future schema development, use `npx prisma migrate dev --name <change_name>` and review the generated SQL before committing. Do not recreate the existing migrations or edit applied migration history.

| Migration | Change |
|---|---|
| `20261106100604_init` | Creates the table, email/phone unique indexes, and original AVAILABLE/ON_DELIVERY/INACTIVE enum |
| `20261106114931_add_service_area_and_status` | Adds required `serviceArea` and replaces the enum with ACTIVE/INACTIVE, default ACTIVE |
| `20261107080000_add_user_authentication` | Adds User, a nullable legacy owner ID, its index, and a restrictive foreign key; removes no records |

All three migrations are verified applied, and the live database-to-schema comparison detected no difference. The second migration still requires care on an older populated database because it removes enum variants and adds a required field. The third migration is additive: both existing agents retained all previous values/timestamps, and their owner IDs remain null pending explicit assignment.

The current `DeliveryAgent` model contains:

| Field | Definition |
|---|---|
| `id` | String primary key, UUID generated by Prisma; SQL storage is TEXT |
| `name` | Required string |
| `email` | Required string, database unique constraint |
| `phone` | Required string, database unique constraint |
| `serviceArea` | Required string |
| `status` | ACTIVE or INACTIVE; default ACTIVE |
| `createdAt` | DateTime, default `now()` |
| `updatedAt` | DateTime maintained by Prisma `@updatedAt` |
| `userId` | Authenticated owner's ID; nullable only to preserve unassigned legacy data |

## Authentication and Existing Data

The User model contains a UUID ID, name, unique normalized email, passwordHash, creation timestamp, and its agents relation. Passwords require at least eight characters and at most 72 UTF-8 bytes; bcrypt uses cost 12. Public responses expose only user ID/name/email, never hashes. Registration also signs in the new account.

| Method | Endpoint | Behavior |
|---|---|---|
| POST | `/api/auth/register` | Name/email/password; 201 with `data: { token, user }`; duplicate email 409 |
| POST | `/api/auth/login` | Email/password; 200 with `data: { token, user }`; invalid credentials 401 |
| GET | `/api/auth/me` | Bearer JWT required; 200 with public user in `data` |

All `/api/agents` routes require `Authorization: Bearer <token>`. HS256 JWT signature, issuer, audience, expiry, and UUID subject are checked. Missing/invalid tokens return 401. Agent queries filter by authenticated user ID; foreign read/update/delete targets return 404. Client owner IDs are rejected by body validation. Existing agent email/phone constraints remain globally unique to preserve the CRUD contract.

**One-time legacy ownership step:** register the intended owner's real account through the UI first. From `server/`, replace the placeholder with that registered email and preview before confirming:

```bash
npm run assign:legacy-agents -- '<registered-owner-email>'
npm run assign:legacy-agents -- '<registered-owner-email>' --confirm
```

Confirmation assigns only currently unowned agents to that chosen account, in a transaction, without changing their existing fields/timestamps or already-owned records. It invalidates only the chosen user's list cache, best effort. This command was verified against a disposable test database; it was **not run with confirmation against your two original records**. There is no default account, hardcoded password, or automatic first-user claim. Until explicitly assigned, legacy rows remain in PostgreSQL but are hidden from all accounts. The nullable column is intentional for this safe transition; all new API agents require ownership.

Login/Register pages reuse the current lavender form design. Protected routes, user labels, logout, account-scoped dashboard/search, and automatic 401 redirects are integrated into the existing shell. Tokens live in sessionStorage and are attached to protected requests. Logout clears the token and per-account frontend data; late list and CRUD callbacks from another account are ignored. A delayed real create response was verified not to change the next account's data, activity, or navigation. See [client/README.md](client/README.md) for frontend commands.

**Minimal-auth limits:** no refresh tokens, password reset, rate limiting, email verification, or server-side logout revocation. Issued JWTs remain valid until expiry; sessionStorage requires XSS precautions. Use HTTPS outside local development. Strong cache consistency remains outside the current scope. The dependency audit reports three high advisories in the existing Prisma toolchain; dependencies were not upgraded, and production readiness is not claimed.

## Docker Compose Operations

Run these from the repository root:

```bash
docker compose up -d
docker compose ps
docker compose logs postgres redis
docker compose exec redis redis-cli ping
docker compose down
```

Redis should answer `PONG`. Containers are named `delivery-postgres` and `delivery-redis`; host ports are 5432 and 6379. Named volumes `postgres_data` and `redis_data` mount at `/var/lib/postgresql/data` and `/data`. `docker compose down` retains named volumes. Do not use `down -v` unless intentionally deleting their data. A Redis volume alone does not establish a durable cache or configure a persistence policy.

During the audit, the shell's `DOCKER_HOST` pointed to an unavailable Podman socket. The actual Docker daemon was accessible at `/var/run/docker.sock`; use `DOCKER_HOST=unix:///var/run/docker.sock` as a command prefix in that environment. This was an environment issue, not a Compose/application defect. No Docker context or environment file was changed.

## Run the Backend

After infrastructure, environment setup, migrations, and client generation, from `server/`:

```bash
npm run dev
```

This uses `node --watch src/server.js`. Use `npm start` to run without watch mode. Default URL: `http://localhost:5000`.

Startup awaits PostgreSQL, which remains required. It starts one Redis connection attempt without awaiting it before listening. Redis's `isOpen` guard avoids duplicate connects; `ready` events log initial/recovered connectivity. Redis failures do not prevent HTTP startup. Bounded, jittered retries include socket timeouts. The backend has no Compose service or new shutdown handler. The existing Vite frontend runs separately; production deployment is not configured.

## API Reference

Base URL: `http://localhost:5000`. Responses below describe code behavior, not proof that every endpoint has passed runtime tests.

| Method | Path | Success response |
|---|---|---|
| GET | `/api/health` | 200, `success` and service-running `message` |
| POST | `/api/agents` | 201, `success`, creation `message`, `data` agent |
| GET | `/api/agents` | 200, `success`, `count`, `data` array ordered by newest `createdAt` |
| GET | `/api/agents/:id` | 200, `success`, `data` agent |
| PATCH | `/api/agents/:id` | 200, `success`, update `message`, `data` agent |
| DELETE | `/api/agents/:id` | 200, `success`, deletion `message`; no `data` field |

The health endpoint stays public and is a process-level response, not a live dependency readiness probe. Agent endpoints are authenticated and owner-filtered; server-side pagination/search filtering is not implemented.

### Request Validation

Create requires `name`, `email`, `phone`, and `serviceArea`. Strings are trimmed. Name and service area require at least two characters, email must have valid email syntax, and phone requires at least ten characters. Phone validation does not enforce digits-only formatting. `status` is optional and accepts only ACTIVE or INACTIVE. Unknown body fields are rejected.

PATCH permits a nonempty subset of those fields with the same constraints. Client-supplied IDs and timestamps are not accepted in bodies. Parameterized routes have UUID validation; valid/missing records and invalid UUIDs were tested through HTTP for read/update/delete.

### Request Examples

Use disposable development data. Save the returned agent ID for the subsequent examples. These workflows passed automated HTTP integration tests in the audit; the commands below are repeatable manual examples, not a record of running these exact commands against your development data.

```bash
curl -i http://localhost:5000/api/health

TOKEN='<JWT returned by registration or login>'
curl -i -X POST http://localhost:5000/api/agents \
	-H "Authorization: Bearer $TOKEN" \
	-H 'Content-Type: application/json' \
	-d '{"name":"Example Agent","email":"agent@example.com","phone":"5550001234","serviceArea":"Central","status":"ACTIVE"}'

curl -i -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/agents

AGENT_ID='<UUID returned by create>'
curl -i -H "Authorization: Bearer $TOKEN" "http://localhost:5000/api/agents/$AGENT_ID"

curl -i -X PATCH "http://localhost:5000/api/agents/$AGENT_ID" \
	-H "Authorization: Bearer $TOKEN" \
	-H 'Content-Type: application/json' \
	-d '{"serviceArea":"North","status":"INACTIVE"}'

curl -i -H "Authorization: Bearer $TOKEN" -X DELETE "http://localhost:5000/api/agents/$AGENT_ID"
```

### Errors

| Condition | Implemented response |
|---|---|
| Zod validation failure | 400; `success: false`, `message: "Validation failed"`, `errors` array of field/message pairs |
| Malformed JSON body | 400; `success: false`, `message: "Invalid JSON body"`; submitted input is not echoed |
| Missing/invalid/expired authentication | 401; generic authentication message |
| Duplicate registration email | 409; `message: "Email already registered"` |
| Duplicate email or phone, Prisma P2002 | 409; `message: "Email or phone number already exists"` |
| Missing record on update/delete, Prisma P2025 | 404; `message: "Delivery agent not found"` |
| Missing individual lookup | Service throws an explicit 404 with the same missing-agent message |
| Unmatched route | 404; `message: "Route not found"` |
| Other errors without `statusCode` | 500; generic `message: "Internal server error"` |

Centralized error responses also include `success: false`. The handler handles malformed JSON separately, then uses `err.statusCode` or 500 for remaining errors. An actual rejected Prisma connection was exercised through an async HTTP controller and produced a generic 500 without exposing internals.

## Testing

Run the non-destructive default suite from `server/`. Live integration tests are explicitly skipped unless enabled:

```bash
npm test
```

The default run passed 29 tests and explicitly marks the integration suite SKIP. It retains six HTTP checks and 18 fallback checks, with five additional auth checks. Test setup generates an in-memory signing secret when none is provided; it never creates default accounts or production credentials. The HTTP 500 test still uses an unused database port without stopping PostgreSQL. Node.js experimental module mocking is retained for tests explicitly labeled mocked.

For real HTTP/PostgreSQL/Redis tests without intentionally stopping Redis:

```bash
RUN_INTEGRATION=1 npm test
```

For the complete audit, including real Docker Redis stop/restart, from `server/`:

```bash
DOCKER_HOST=unix:///var/run/docker.sock RUN_INTEGRATION=1 RUN_REDIS_OUTAGE=1 npm test
```

The host prefix is specific to the audited environment; omit or adjust it if your normal Docker endpoint already works. Enabling `RUN_REDIS_OUTAGE` disrupts the shared Redis container briefly, so run only in a development environment. PostgreSQL is never stopped by these tests.

The integration harness requires a configured `DATABASE_URL`, a PostgreSQL role allowed to create databases, Redis database 15 available and empty, and Docker access for outage tests. It creates a random `delivery_audit_*` database and applies the existing migrations there. The actual backend starts on a temporary port with that database and Redis DB 15. Tests use unique agent values; the harness kills only its own backend process, restores Redis through cleanup hooks, clears only its isolated cache keys, and drops only the database it created. A count/digest check verifies existing development records remain unchanged. No volumes or existing migrations are removed.

### Verified Audit Results

The authentication update's full run executed 98 tests: 98 passed, zero failed/cancelled/skipped. It includes 69 real integration cases, six HTTP middleware cases, 18 fallback cases, and five auth unit cases. Original CRUD/outage coverage remains. New cases verify hashing, login/me, malformed/expired tokens, missing authentication, foreign-account 404, owner injection rejection, user-specific caches, and explicit safe legacy assignment. Browser checks also verified registration, login, logout, session restoration, account switching, scoped search, and invalid-token clearing. The production frontend build passed.

| Area | Verified result |
|---|---|
| CRUD and validation | Valid create/read/update/delete; missing/invalid fields, UUIDs, status, unknown fields, empty PATCH; updatedAt advances |
| Database errors | Real P2002 conflicts return 409; missing read/update/delete return 404 |
| HTTP middleware/errors | Helmet/CORS headers, unmatched-route 404, safe malformed JSON 400, real async database-failure 500 |
| Redis caching | Actual list/detail JSON, MISS/HIT logs, positive TTL up to 60 seconds, no TTL refresh on hits |
| Cache invalidation | Populated list/detail keys removed after mutations; next reads return fresh data |
| Redis outage/recovery | Live Docker stop/restart; all CRUD works offline; process stays alive; a new backend starts with Redis absent; automatic reconnect and cache use observed |
| Database/infrastructure | PostgreSQL 17.11 and Redis 7.4.12 reachable; Prisma 6.19.3 retained; three migrations applied; no schema drift; Compose running |
| Data safety | Development records unchanged; disposable database removed; Redis DB 15 emptied; Redis restored |

**Defect fixed:** malformed JSON previously echoed raw submitted text through the parser message. The handler now returns a generic `Invalid JSON body` response before logging that parser error. The first broad run also found two test-harness errors (Redis multi-key EXISTS signature and local-time parsing of SQL timestamps), which were corrected without changing application behavior. It initially reported seven failed assertions and seven cancelled outage cases; the final expanded full rerun passed all 74.

**Not performed:** PostgreSQL container-restart persistence, load/concurrency testing, and production deployment/security certification. PostgreSQL stayed running. The environment example is now populated and startup validation is active; a real JWT_SECRET must still be configured privately for normal restarts. Original agents remain unassigned until the operator selects their account.

Run the examples above against a disposable development database and check HTTP status, response shape, and persisted data. To exercise a phone conflict, create a second agent with a different email but the same phone and expect 409. For validation, submit an invalid email, short name, unknown field, or empty PATCH and check the documented 400 response. Verify individual reads, update persistence, deletion, and unknown UUID behavior separately; record any failures before marking them complete.

## Redis Status and Roadmap

### Implemented Cache Behavior

PostgreSQL is the persistent source of truth. Redis is an optional optimization, never the authority for mutations.

| Service | Behavior |
|---|---|
| Create | Write authenticated ownership to PostgreSQL, then invalidate `agents:list:<userId>` best effort |
| List | Read `agents:list:<userId>`; on miss/failure query only that user's agents and cache the result |
| Individual retrieval | Read `agents:<userId>:<agentId>`; on miss/failure perform an owner-filtered query, preserving missing/foreign-agent 404 |
| Update/delete | Mutate PostgreSQL, then best-effort invalidate list and affected detail key |

Cache values are JSON with unchanged `EX: 60`. Helpers and offline fallback are retained; mutations invalidate only the authenticated account's list/detail keys. Old shared keys are no longer read and may expire naturally. Response envelopes are preserved; queries now enforce ownership, and agent records include `userId`.

The client disables offline queueing, so a disconnect race rejects a command instead of replaying cache work later. It has a 1-second connection timeout, a 2-second socket inactivity timeout, and a 1-second idle ping interval to detect stalled connections without closing healthy idle sockets. These are client transport settings, not the cache TTL or a strict end-to-end API deadline. Retry delays grow from 50 ms to 2 seconds, plus up to 199 ms of jitter. This explicit policy also retries socket timeouts, unlike Redis 6.3.1's default policy. Caching resumes when the client becomes ready.

**Limitations:** Skipped/failed invalidation is not retried. Redis may retain old entries across a short outage; they can be served after reconnection until their TTL expires. Concurrent cache-aside reads and mutations can also repopulate stale data. Strong cache consistency and durable invalidation are not implemented. Repeated outage warnings can be noisy. A syntactically valid Redis URL is assumed; invalid configuration during client construction is not covered by connection fallback.

### Manual Redis Verification

The corresponding automated scenarios passed during the audit. These commands are optional repetition of verified behavior, not remaining unperformed checks.

Use a disposable development database. The commands below create/update/delete test records and clear only the listed cache keys; do not use them against production. Backend requests use port 5000 unless your `PORT` differs.

Start infrastructure from the repository root, then keep the backend running in a separate terminal:

```bash
docker compose up -d postgres redis
cd server
npm run dev
```

Run the following checks in another terminal at the repository root. Set TOKEN and USER_ID from your authenticated account, then retain the variables/helper between steps:

```bash
TOKEN='<JWT returned by login>'
USER_ID='<authenticated user ID>'
auth_curl() { curl -H "Authorization: Bearer $TOKEN" "$@"; }
```

#### 1. Normal Cache Miss and Hit

```bash
BASE=http://localhost:5000
TAG=$(date +%s%N)
CREATED=$(auth_curl -fsS -X POST "$BASE/api/agents" \
	-H 'Content-Type: application/json' \
	-d "{\"name\":\"Redis Test\",\"email\":\"redis-$TAG@example.com\",\"phone\":\"555$TAG\",\"serviceArea\":\"Central\"}")
AGENT_ID=$(printf '%s' "$CREATED" | node -e 'console.log(JSON.parse(require("node:fs").readFileSync(0,"utf8")).data.id)')
docker compose exec -T redis redis-cli DEL "agents:list:$USER_ID" "agents:$USER_ID:$AGENT_ID"
auth_curl -i "$BASE/api/agents"
auth_curl -i "$BASE/api/agents"
auth_curl -i "$BASE/api/agents/$AGENT_ID"
auth_curl -i "$BASE/api/agents/$AGENT_ID"
docker compose exec -T redis redis-cli TTL "agents:list:$USER_ID"
docker compose exec -T redis redis-cli TTL "agents:$USER_ID:$AGENT_ID"
```

Expect MISS then HIT logs for each key and HTTP 200 reads. TTL should be positive and at most 60 immediately after population (`-2` means absent, `-1` means no expiry). Create's success contract is 201. Successful normal mutations invalidate the list after create and list/detail after update/delete; inspect keys before issuing another read if checking invalidation.

#### 2. List Retrieval With Redis Stopped

```bash
docker compose stop redis
auth_curl -i "$BASE/api/agents"
```

Expect HTTP 200 from PostgreSQL despite Redis warnings. To additionally check optional startup, stop only the backend with Ctrl+C and run `npm start` from `server/` while Redis is still stopped; it should listen after PostgreSQL connects. Leave that backend running for the following checks.

#### 3. Individual Retrieval With Redis Stopped

```bash
auth_curl -i "$BASE/api/agents/$AGENT_ID"
```

Expect HTTP 200 for the existing agent, fetched from PostgreSQL.

#### 4. Create With Redis Stopped

```bash
TAG=$(date +%s%N)
OFFLINE_CREATED=$(auth_curl -fsS -X POST "$BASE/api/agents" \
	-H 'Content-Type: application/json' \
	-d "{\"name\":\"Offline Test\",\"email\":\"offline-$TAG@example.com\",\"phone\":\"555$TAG\",\"serviceArea\":\"Central\"}")
printf '%s\n' "$OFFLINE_CREATED"
OFFLINE_ID=$(printf '%s' "$OFFLINE_CREATED" | node -e 'console.log(JSON.parse(require("node:fs").readFileSync(0,"utf8")).data.id)')
auth_curl -i "$BASE/api/agents/$OFFLINE_ID"
```

Create should return its existing success payload (201); follow-up retrieval should be 200 with the persisted record. `curl -f` rejects HTTP errors; it is not a full response assertion.

#### 5. Update With Redis Stopped

```bash
auth_curl -i -X PATCH "$BASE/api/agents/$OFFLINE_ID" \
	-H 'Content-Type: application/json' \
	-d '{"serviceArea":"North","status":"INACTIVE"}'
auth_curl -i "$BASE/api/agents/$OFFLINE_ID"
```

Expect HTTP 200 and a subsequent read showing the changed fields.

#### 6. Delete With Redis Stopped

```bash
auth_curl -i -X DELETE "$BASE/api/agents/$OFFLINE_ID"
auth_curl -i "$BASE/api/agents/$OFFLINE_ID"
```

Expect the existing delete response (200), followed by missing-agent 404. Database validation/unique errors should still fail normally, not be swallowed as cache failures.

#### 7. Restart Redis and Resume Caching

```bash
docker compose start redis
docker compose exec -T redis redis-cli PING
```

Once Redis returns PONG and the backend logs `Redis connected successfully`, run these without restarting the backend. Clear the test keys to disambiguate fresh caching from entries retained across the outage:

```bash
docker compose exec -T redis redis-cli DEL "agents:list:$USER_ID" "agents:$USER_ID:$AGENT_ID"
auth_curl -i "$BASE/api/agents"
auth_curl -i "$BASE/api/agents"
auth_curl -i "$BASE/api/agents/$AGENT_ID"
auth_curl -i "$BASE/api/agents/$AGENT_ID"
docker compose exec -T redis redis-cli TTL "agents:list:$USER_ID"
docker compose exec -T redis redis-cli TTL "agents:$USER_ID:$AGENT_ID"
auth_curl -i -X DELETE "$BASE/api/agents/$AGENT_ID"
docker compose exec -T redis redis-cli EXISTS "agents:list:$USER_ID" "agents:$USER_ID:$AGENT_ID"
```

Expect MISS then HIT, positive TTLs up to 60, successful test-record cleanup, and zero existing cache keys after deletion if no concurrent read repopulates them. Record actual results before describing this as verified live behavior.

Next work:

1. Extend the verified suite when backend behavior changes; consider load/concurrency and dedicated-environment tests.
2. Configure a private persistent JWT signing secret and explicitly assign legacy agents to the intended account.
3. Consider stronger cache consistency guarantees for missed invalidation and concurrent stale repopulation; live outage/recovery is already verified.
4. Retain the existing React dashboard, CRUD, and search when extending account features.
5. Complete end-to-end integration and submission documentation; repository publication remains a manual step.

## Project Documentation

- [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md): assignment scope, phases, remaining deliverables.
- [docs/DEVELOPMENT_LOG.md](docs/DEVELOPMENT_LOG.md): implementation history and debugging lessons.
- [docs/TECHNICAL_DECISIONS.md](docs/TECHNICAL_DECISIONS.md): implemented choices and planned architecture.
- [docs/INTERVIEW_PREPARATION.md](docs/INTERVIEW_PREPARATION.md): concepts and practical project questions.