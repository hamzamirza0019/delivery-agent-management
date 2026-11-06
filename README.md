cat > README.md <<'EOF'
# Delivery Agent Management System

A full-stack web application for managing delivery agents.

The application provides CRUD operations through a RESTful API, with Redis caching for frequently accessed data.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| ORM | Prisma 7 |
| Cache | Redis |
| Validation | Zod |
| Infrastructure | Docker Compose |

## Project Structure

```text
delivery-agent-management/
├── client/
├── server/
├── docs/
├── compose.yaml
├── README.md
└── .gitignore