# Delivery Agent Management — Frontend

React + Vite JavaScript frontend matching the finalized Aone Tech purple/lavender design reference.

## Requirements
- Node.js 22+
- Backend running at `http://localhost:5000`

## Run locally
```bash
cp .env.example .env
npm install
npm run dev
```
Open the URL printed by Vite (normally `http://localhost:5173`).

## API configuration
Set `VITE_API_BASE_URL` in `.env` if your backend uses another URL. Default:
`http://localhost:5000/api`

The UI calls:
- `GET /agents`
- `GET /agents/:id`
- `POST /agents`
- `PATCH /agents/:id`
- `DELETE /agents/:id`

Create/update payload fields: `name`, `email`, `phone`, `serviceArea`, `status` (`ACTIVE` or `INACTIVE`).

## Included
- Dashboard with live total/active/inactive counts, status visualization and recent agents
- Searchable/filterable agent directory with pagination
- Add, edit, view and delete flows
- Client-side form validation, loading/error states and delete confirmation
- Responsive layout and purple/lavender styling

## Important integration note
The API helper accepts a plain array response or common `{ data: [...] }` / `{ agents: [...] }` list wrappers. If your backend returns a different response envelope, adjust `unwrap()` in `src/api.js`. The UI does not use mock agents; it displays records returned by the backend.
