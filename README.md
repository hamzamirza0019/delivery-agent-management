# Delivery Agent Management System

A project for managing delivery agents through a REST API and a planned React interface. At the 2026-11-06 milestone, the backend CRUD implementation exists; the frontend and Redis response caching do not.

Implementation statements below are based on repository inspection. Successful startup, database migrations, create/list requests, and duplicate-phone rejection are reported milestone results, not tests rerun during this documentation update. Update and delete still require verification.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React + Vite, planned; `client/` is empty |
| Backend | Node.js + Express 5, JavaScript ES modules |
| Database | PostgreSQL |
| ORM | Prisma Client and CLI 6.19.3 in the lockfile |
| Cache | Redis client connected; caching pending |
| Validation | Zod |
| Infrastructure | Docker Compose |
| Version control | Git; current branch is `main` |

The dependency declarations use `^6.19.3` for Prisma. The Compose images are `postgres:17-alpine` and `redis:7-alpine`.

## Architecture

```text
HTTP request -> Express middleware -> agent router -> Zod validation
						 -> controller -> service -> Prisma Client -> PostgreSQL
HTTP errors  -> centralized error middleware -> JSON response

Server startup -> PostgreSQL connection -> Redis connection -> listen
React frontend -> API (planned)
Read services  -> Redis cache-aside layer (planned)
```

Helmet, default CORS, JSON parsing, and Morgan are configured in the application. Controllers handle HTTP responses; services perform database operations. Express 5 forwards rejected async handlers to error middleware. Redis is connected before listening but is not used by the agent services. Docker Compose runs the databases only; the backend runs on the host.

## Implementation Status

| Feature | Status |
|---|---|
| Git initialization and `main` branch | Complete |
| PostgreSQL/Redis infrastructure and connections | Configured; successful startup reported |
| DeliveryAgent schema and two migrations | Present; application of both migrations reported |
| Create and list endpoints | Implemented; successful manual tests reported |
| Duplicate phone conflict | HTTP 409 handling implemented; manual test reported |
| Individual retrieval, update, delete | Implemented; verification pending |
| Zod validation and centralized errors | Implemented; broader negative-case testing pending |
| Health endpoint and unmatched-route response | Implemented |
| Environment-validation module | Written, but not imported by startup |
| Redis response caching, TTL, invalidation | Not implemented |
| React + Vite frontend | Not implemented |
| Automated tests | Not implemented; `npm test` is a failing placeholder |

## Project Structure

```text
delivery-agent-management/
|-- client/                         # Empty; planned frontend
|-- server/
|   |-- package.json
|   |-- package-lock.json
|   |-- .env.example                # Currently empty
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
- A local repository checkout. There is no root npm package or frontend installation command yet.

## Installation and Environment

From the repository root:

```bash
docker compose up -d
docker compose ps
cd server
npm ci
cp -n .env.example .env
```

The copy command preserves an existing local `.env`. The existing environment example is empty. Populate `server/.env` locally; copying the example alone is insufficient. The following values are placeholders, not usable database credentials:

```dotenv
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@localhost:5432/<POSTGRES_DB>?schema=public
REDIS_URL=redis://localhost:6379
```

Replace database placeholders with the values configured in [compose.yaml](compose.yaml). URL-encode special characters in connection credentials. Do not commit `.env` or share actual credentials. The Compose file currently contains fixed local development database credentials; this is not a production secret-management setup.

| Variable | Current use |
|---|---|
| `PORT` | Read directly in startup; defaults to 5000 |
| `DATABASE_URL` | PostgreSQL connection URL declared in the Prisma datasource |
| `REDIS_URL` | Passed to the Redis client; set it explicitly for this setup |
| `NODE_ENV` | Declared in the environment schema; no custom runtime behavior currently uses it |

[server/src/config/env.js](server/src/config/env.js) defines a Zod configuration schema but is not imported by the running server. Startup does not currently enforce that schema. Run backend and Prisma commands from `server/` so dotenv finds the local `.env` file.

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

Both migrations are reported applied at this milestone. The second migration warns that existing AVAILABLE/ON_DELIVERY values cannot be cast to the replacement enum and that a required column without a default cannot be added to a nonempty table. An older populated database needs a reviewed data-migration plan before applying it; a fresh database has no such rows.

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

## Run the Backend

After infrastructure, environment setup, migrations, and client generation, from `server/`:

```bash
npm run dev
```

This uses `node --watch src/server.js`. Use `npm start` to run without watch mode. Default URL: `http://localhost:5000`.

Startup connects to PostgreSQL and Redis before listening. If either initial connection fails, startup fails rather than serving a database-only fallback. There is no backend container, frontend dev server, or production deployment setup yet.

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

The health endpoint is a process-level response, not a live database/Redis readiness probe. No pagination, filtering, authentication, or authorization is implemented.

### Request Validation

Create requires `name`, `email`, `phone`, and `serviceArea`. Strings are trimmed. Name and service area require at least two characters, email must have valid email syntax, and phone requires at least ten characters. Phone validation does not enforce digits-only formatting. `status` is optional and accepts only ACTIVE or INACTIVE. Unknown body fields are rejected.

PATCH permits a nonempty subset of those fields with the same constraints. Client-supplied IDs and timestamps are not accepted in bodies. Parameterized routes have UUID validation. Verification of these parameterized paths remains pending.

### Request Examples

Use disposable development data. Save the returned agent ID for the subsequent examples; update/delete examples are verification steps, not passed tests.

```bash
curl -i http://localhost:5000/api/health

curl -i -X POST http://localhost:5000/api/agents \
	-H 'Content-Type: application/json' \
	-d '{"name":"Example Agent","email":"agent@example.com","phone":"5550001234","serviceArea":"Central","status":"ACTIVE"}'

curl -i http://localhost:5000/api/agents

AGENT_ID='<UUID returned by create>'
curl -i "http://localhost:5000/api/agents/$AGENT_ID"

curl -i -X PATCH "http://localhost:5000/api/agents/$AGENT_ID" \
	-H 'Content-Type: application/json' \
	-d '{"serviceArea":"North","status":"INACTIVE"}'

curl -i -X DELETE "http://localhost:5000/api/agents/$AGENT_ID"
```

### Errors

| Condition | Implemented response |
|---|---|
| Zod validation failure | 400; `success: false`, `message: "Validation failed"`, `errors` array of field/message pairs |
| Duplicate email or phone, Prisma P2002 | 409; `message: "Email or phone number already exists"` |
| Missing record on update/delete, Prisma P2025 | 404; `message: "Delivery agent not found"` |
| Missing individual lookup | Service throws an explicit 404 with the same missing-agent message |
| Unmatched route | 404; `message: "Route not found"` |
| Other errors without `statusCode` | 500; generic `message: "Internal server error"` |

Centralized error responses also include `success: false`. The handler uses `err.statusCode` or 500; broader parser-error behavior still needs verification.

## Testing

No automated suite is configured. `npm test` currently prints `Error: no test specified` and exits with failure; it is not a quality gate.

Reported successful manual checks: backend startup on port 5000, PostgreSQL and Redis connections, application of both migrations, agent creation, listing, and duplicate-phone rejection. No update/delete success is claimed. Individual retrieval, duplicate-email handling, validation cases, and missing-record mappings need verification as well.

Run the examples above against a disposable development database and check HTTP status, response shape, and persisted data. To exercise a phone conflict, create a second agent with a different email but the same phone and expect 409. For validation, submit an invalid email, short name, unknown field, or empty PATCH and check the documented 400 response. Verify individual reads, update persistence, deletion, and unknown UUID behavior separately; record any failures before marking them complete.

## Redis Status and Roadmap

Redis connectivity is implemented. There are no API cache reads/writes, cache keys, TTLs, or invalidation calls in the services.

Next work:

1. Verify parameterized endpoints, update/delete, and negative cases; add automated API tests.
2. Populate the environment example and wire startup configuration validation in a future code change.
3. Implement and test cache-aside reads, TTL, and write invalidation; decide Redis outage behavior.
4. Initialize React + Vite and build listing, create/edit forms, deletion, loading, and error states.
5. Complete end-to-end integration and submission documentation; repository publication remains a manual step.

## Project Documentation

- [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md): assignment scope, phases, remaining deliverables.
- [docs/DEVELOPMENT_LOG.md](docs/DEVELOPMENT_LOG.md): implementation history and debugging lessons.
- [docs/TECHNICAL_DECISIONS.md](docs/TECHNICAL_DECISIONS.md): implemented choices and planned architecture.
- [docs/INTERVIEW_PREPARATION.md](docs/INTERVIEW_PREPARATION.md): concepts and practical project questions.