# Delivery Agent Management System

## 1. Project Overview

A full-stack web application for managing delivery agents.

The application will allow users to create, view, update, and delete delivery agent records through a RESTful backend API.

Redis will be used to cache suitable read responses and improve API performance while maintaining cache consistency when records change.

## 2. Project Objectives

These are the assignment requirements recorded in the existing project plan, not a claim that every deliverable is complete. The external assignment brief is not present in this repository; exact wording and submission criteria still need confirmation.

- Implement complete CRUD functionality for delivery agents.
- Design RESTful APIs with appropriate HTTP methods and status codes.
- Implement request validation and centralized error handling.
- Integrate Redis caching for frequently accessed read responses.
- Maintain cache consistency after create, update, and delete operations.
- Build a usable frontend for managing delivery agents.
- Provide clear setup, database migration, and testing instructions.

## 3. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite (pending) |
| Backend | Node.js + Express 5, JavaScript ES modules |
| Database | PostgreSQL |
| ORM | Prisma 6.19.3 (lockfile); replaces initial 7.10.1 setup |
| Cache | Redis connectivity implemented; API caching pending |
| Validation | Zod |
| Containerization | Docker Compose |
| Version Control | Git on main; GitHub publication remains a submission task |

### Database Choice: PostgreSQL

PostgreSQL is selected as the persistent database because it provides:

- Relational data storage.
- Unique constraints for email and phone numbers.
- Reliable transactions.
- Data integrity and consistency.

Prisma 6.19.3 is the current ORM and migration tool, using `prisma-client-js` and imports from `@prisma/client`. JavaScript avoids a backend TypeScript compilation step; React + Vite remains the frontend decision, not an implementation.

## 4. Delivery Agent Data Model

The implemented Prisma model contains:

| Field | Description |
|---|---|
| id | Prisma-generated UUID string primary key (SQL TEXT) |
| name | Full name |
| phone | Required phone number, unique |
| email | Required email address, unique |
| serviceArea | Agent's assigned service area |
| status | ACTIVE or INACTIVE, default ACTIVE |
| createdAt | Record creation timestamp |
| updatedAt | Last update timestamp |

## 5. Core Functional Requirements

### Agent Management

- [x] Implement create (successful manual test reported).
- [x] Implement list (successful manual test reported).
- [x] Implement individual retrieval (verification pending).
- [x] Implement update (verification pending).
- [x] Implement delete (verification pending).

Checked implementation boxes do not imply tested behavior. Successful test results are milestone reports, not reruns during this documentation update.

### API Requirements

- [x] Use POST, GET, PATCH, and DELETE.
- [x] Implement success and error HTTP status codes.
- [x] Implement Zod body and UUID parameter validation.
- [x] Map duplicate records (P2002) to 409; duplicate phone tested as reported.
- [x] Map missing records to 404; runtime verification pending.
- [x] Implement structured validation errors and centralized error responses.

### Redis Caching

- [ ] Cache the delivery agent list.
- [ ] Cache individual agent details.
- [ ] Define appropriate cache expiration.
- [ ] Invalidate or refresh affected cache entries after create, update, and delete operations.
- [ ] Document the caching strategy.

## 6. API Design (Implemented; Verification Incomplete)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/agents | Create agent |
| GET | /api/agents | Retrieve all agents |
| GET | /api/agents/:id | Retrieve individual agent |
| PATCH | /api/agents/:id | Update agent |
| DELETE | /api/agents/:id | Delete agent |

`GET /api/health` is also implemented as a service-running response. Create returns 201; other CRUD success responses use 200, including delete. List returns newest records first with a count. No pagination, filtering, or authentication is implemented. See [../README.md](../README.md) for request examples and validation details.

## 7. Development Roadmap

### Phase 1: Project Setup and Infrastructure
- [x] Create project directory.
- [x] Initialize Git repository.
- [x] Configure backend dependencies.
- [x] Configure Docker Compose.
- [x] Set up PostgreSQL and Redis containers.
- [x] Initialize Prisma 7.10.1 historically; move current setup to 6.19.3.
- [x] Generate Prisma Client.
- [x] Apply initial database migration.
- [x] Replace initial adapter configuration with standard Prisma 6 client import.
- [x] Configure Redis client.
- [x] Write environment-validation module.
- [ ] Wire environment-validation module into startup and populate empty environment example.
- [x] Configure Express application and server startup.

### Phase 2: Database and Backend Development
- [x] Finalize current DeliveryAgent schema with service area and ACTIVE/INACTIVE status.
- [x] Apply `init` and `add_service_area_and_status` migrations (reported).
- [x] Implement database connection.
- [x] Implement CRUD services.
- [x] Implement API controllers and routes.
- [x] Implement request validation.
- [x] Implement centralized error handling for P2002, P2025, and unexpected errors.
- [x] Implement health-check endpoint.

### Phase 3: Redis Integration
- [x] Connect Redis during startup (successful connection reported).
- [ ] Implement agent-list caching.
- [ ] Implement individual-agent caching.
- [ ] Implement cache invalidation.
- [ ] Verify cache consistency.

### Phase 4: Backend Testing
- [x] Test create operation (reported successful).
- [x] Test list operation (reported successful).
- [x] Test duplicate phone rejection (reported successful).
- [ ] Test individual retrieval and parameter validation compatibility.
- [ ] Test update operation.
- [ ] Test delete operation.
- [ ] Test invalid input and missing records.
- [ ] Test duplicate email rejection and malformed JSON handling.
- [ ] Replace placeholder npm test script with an automated suite.
- [ ] Test Redis caching and invalidation.

### Phase 5: Frontend Development
- [ ] Initialize React + Vite.
- [ ] Build agent listing interface.
- [ ] Build agent creation form.
- [ ] Build agent update functionality.
- [ ] Implement agent deletion.
- [ ] Integrate frontend with backend APIs.
- [ ] Implement loading and error states.

### Phase 6: Integration and Quality Assurance
- [ ] Test complete CRUD workflows.
- [ ] Verify frontend-backend integration.
- [ ] Verify database persistence.
- [ ] Verify Redis cache consistency.
- [ ] Fix identified issues.

### Phase 7: Documentation and Submission
- [x] Update all five Markdown documents for the current milestone.
- [x] Document environment requirements and current example/validation gaps.
- [x] Document database setup and both migrations.
- [x] Document planned Redis caching strategy, clearly labeled pending.
- [x] Document implemented API endpoints and request examples.
- [x] Document manual testing instructions and verification gaps.
- [ ] Update documentation again after caching, frontend, and full test verification.
- [ ] Push repository to GitHub.
- [ ] Verify repository is accessible for evaluation.

## 8. Current Project Status

**Current phase:** Backend implementation milestone; endpoint verification is in progress. Redis caching and frontend implementation remain pending.

PostgreSQL and Redis are configured through Docker Compose. The Express backend connects to both before listening on port 5000 by default. Prisma 6.19.3 is used, and both checked-in migrations are reported applied. CRUD, validation, and centralized errors exist.

Create/list and duplicate-phone rejection have reported successful tests. Update/delete and individual retrieval must still be verified. Redis is connected but has no cache behavior; `client/` is empty.

### Remaining Deliverables

- Verified CRUD and negative-case behavior with recorded results and automated tests.
- Working environment example and integrated startup configuration validation.
- Implemented Redis cache-aside reads, TTL, invalidation, and consistency tests.
- React + Vite interface integrated with the backend.
- End-to-end checks for CRUD, persistence, frontend error states, and cache consistency.
- Final documentation and assignment submission; remote publication/accessibility still need confirmation. No commit or push is part of this documentation update.

## 9. Scope Control

The primary focus is completing the candidate assignment requirements correctly.

Optional enhancements will only be considered after all core requirements have been implemented and tested.