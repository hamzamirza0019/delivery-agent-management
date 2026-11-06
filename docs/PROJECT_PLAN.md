# Delivery Agent Management System

## 1. Project Overview

A full-stack web application for managing delivery agents.

The application will allow users to create, view, update, and delete delivery agent records through a RESTful backend API.

Redis will be used to cache suitable read responses and improve API performance while maintaining cache consistency when records change.

## 2. Project Objectives

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
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| ORM | Prisma 7 |
| Cache | Redis |
| Validation | Zod |
| Containerization | Docker Compose |
| Version Control | Git + GitHub |

### Database Choice: PostgreSQL

PostgreSQL is selected as the persistent database because it provides:

- Relational data storage.
- Unique constraints for email and phone numbers.
- Reliable transactions.
- Data integrity and consistency.

Prisma 7 will be used as the ORM and migration tool.

## 4. Delivery Agent Data Model

Each delivery agent will contain:

| Field | Description |
|---|---|
| id | Unique agent identifier (UUID) |
| name | Full name |
| phone | Phone number |
| email | Email address |
| serviceArea | Agent's assigned service area |
| status | ACTIVE or INACTIVE |
| createdAt | Record creation timestamp |
| updatedAt | Last update timestamp |

## 5. Core Functional Requirements

### Agent Management

- [ ] Create a delivery agent.
- [ ] Retrieve all delivery agents.
- [ ] Retrieve an individual delivery agent.
- [ ] Update delivery agent information.
- [ ] Delete a delivery agent.

### API Requirements

- [ ] Use appropriate HTTP methods.
- [ ] Return suitable HTTP status codes.
- [ ] Validate incoming requests.
- [ ] Handle duplicate records.
- [ ] Handle missing records.
- [ ] Provide clear error responses.

### Redis Caching

- [ ] Cache the delivery agent list.
- [ ] Cache individual agent details.
- [ ] Define appropriate cache expiration.
- [ ] Invalidate or refresh affected cache entries after create, update, and delete operations.
- [ ] Document the caching strategy.

## 6. API Design (Planned)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/agents | Create agent |
| GET | /api/agents | Retrieve all agents |
| GET | /api/agents/:id | Retrieve individual agent |
| PATCH | /api/agents/:id | Update agent |
| DELETE | /api/agents/:id | Delete agent |

## 7. Development Roadmap

### Phase 1: Project Setup and Infrastructure
- [x] Create project directory.
- [x] Initialize Git repository.
- [x] Configure backend dependencies.
- [x] Configure Docker Compose.
- [x] Set up PostgreSQL and Redis containers.
- [x] Initialize Prisma 7.
- [x] Generate Prisma Client.
- [x] Apply initial database migration.
- [x] Configure Prisma adapter.
- [x] Configure Redis client.
- [x] Configure environment validation.
- [ ] Configure Express application and server startup.

### Phase 2: Database and Backend Development
- [ ] Finalize DeliveryAgent schema.
- [ ] Implement database connection.
- [ ] Implement CRUD services.
- [ ] Implement API controllers and routes.
- [ ] Implement request validation.
- [ ] Implement centralized error handling.
- [ ] Implement health-check endpoint.

### Phase 3: Redis Integration
- [ ] Implement agent-list caching.
- [ ] Implement individual-agent caching.
- [ ] Implement cache invalidation.
- [ ] Verify cache consistency.

### Phase 4: Backend Testing
- [ ] Test create operation.
- [ ] Test list and individual retrieval.
- [ ] Test update operation.
- [ ] Test delete operation.
- [ ] Test invalid input and missing records.
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
- [ ] Complete README.
- [ ] Document environment variables.
- [ ] Document database setup and migrations.
- [ ] Document Redis caching strategy.
- [ ] Document API endpoints.
- [ ] Document testing instructions.
- [ ] Push repository to GitHub.
- [ ] Verify repository is accessible for evaluation.

## 8. Current Project Status

**Current phase:** Project setup and infrastructure.

PostgreSQL and Redis infrastructure has been configured using Docker Compose. Prisma 7 has been initialized, and the initial DeliveryAgent migration has been applied.

The backend application implementation is the next major task.

## 9. Scope Control

The primary focus is completing the candidate assignment requirements correctly.

Optional enhancements will only be considered after all core requirements have been implemented and tested.