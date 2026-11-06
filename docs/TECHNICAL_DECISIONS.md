cat > docs/TECHNICAL_DECISIONS.md <<'EOF'
# Technical Decisions

## 1. Backend: Node.js + Express

**Decision:** Use Node.js with Express.

**Reason:**
- Lightweight backend framework.
- Supports REST API development.
- Middleware-based architecture.
- Large ecosystem.

## 2. Database: PostgreSQL

**Decision:** Use PostgreSQL for persistent storage.

**Reason:**
- Relational database suited to structured agent records.
- Supports unique constraints.
- Provides transactions and data integrity.
- Reliable persistent storage.

## 3. ORM: Prisma 7

**Decision:** Use Prisma 7 with the PostgreSQL driver adapter.

**Reason:**
- Type-safe database queries.
- Schema-based data modeling.
- Database migration management.
- Generated Prisma Client.

## 4. Caching: Redis

**Decision:** Use Redis for caching frequently accessed API responses.

**Planned caching strategy:**
- Cache the delivery agent list.
- Cache individual agent details.
- Use cache-aside pattern.
- Apply a configurable TTL.
- Invalidate affected cache entries after create, update, and delete operations.

**Planned cache keys:**
- agents:list
- agents:{id}

## 5. Frontend: React + Vite

**Decision:** Use React with Vite.

**Reason:**
- Component-based UI development.
- Fast development server.
- Suitable for building an agent management dashboard.

## 6. Infrastructure: Docker Compose

**Decision:** Run PostgreSQL and Redis using Docker Compose.

**Reason:**
- Reproducible development environment.
- Isolated infrastructure services.
- Simplified service startup and management.

Node.js backend and frontend will run directly on Ubuntu during development.

## 7. Validation: Zod

**Decision:** Use Zod for request validation.

**Reason:**
- Schema-based validation.
- Clear validation errors.
- Reusable validation schemas.

## 8. Version Control: Git

**Decision:** Use Git and GitHub.

**Reason:**
- Track development history.
- Maintain versioned source code.
- Enable repository-based project submission.
EOF