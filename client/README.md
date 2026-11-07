# Agent Hub — Aone Tech Frontend

React + Vite JavaScript frontend matching the finalized Aone Tech purple/lavender design reference.

## Requirements
- Node.js 22+
- Backend running at `http://localhost:5000`
- Backend authentication migration applied and a private JWT_SECRET configured.

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
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /agents`
- `GET /agents/:id`
- `POST /agents`
- `PATCH /agents/:id`
- `DELETE /agents/:id`

Create/update payload fields: `name`, `email`, `phone`, `serviceArea`, `status` (`ACTIVE` or `INACTIVE`).

Protected requests include a Bearer token from sessionStorage; JWT_SECRET is backend-only. Registration signs in the account, `/me` restores its identity on reload, and 401 responses clear the session and redirect to Login. Logout clears account data and the token. All agent ownership is enforced by the backend, including foreign-agent 404 responses. Existing legacy agents remain hidden until an operator explicitly assigns them; see [../README.md](../README.md#authentication-and-existing-data).

## Included
- Dashboard with live total/active/inactive counts, status visualization and recent agents
- Searchable/filterable agent directory with pagination
- Add, edit, view and delete flows
- Client-side form validation, loading/error states and delete confirmation
- Responsive layout and purple/lavender styling
- Global name/email/phone search using the shared fetched agents, with keyboard navigation and query handoff
- Login/Register pages, protected routes, logout, and logged-in user labels without replacing the dashboard layout

## Verification
The production build (`npm run build`) passed after authentication integration. Live browser checks passed registration/login, invalid credentials, token/session clearing, account switching, foreign-agent protection, and account-scoped global search. A delayed real create response was verified not to update the next account's data, activity, or navigation. Auth form layout was checked at desktop and 390/320-pixel mobile widths. Browser test accounts and agents were removed by exact IDs; the two original agents were preserved and left unassigned.

The minimal session uses sessionStorage (XSS precautions required), has no refresh tokens/password reset, and does not revoke issued JWTs on logout. Configure a stable private backend signing secret before normal restarts; the verification server uses a temporary generated in-memory secret.

## Important integration note
The API helper accepts a plain array response or common `{ data: [...] }` / `{ agents: [...] }` list wrappers. If your backend returns a different response envelope, adjust `unwrap()` in `src/api.js`. The UI does not use mock agents; it displays records returned by the backend.
