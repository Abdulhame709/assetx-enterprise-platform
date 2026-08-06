# AssetX Web — Developer Setup & Operations Guide

> Phase PRE-P3.1 — Real Backend & Authentication Integration.
> This document lets any developer run the full stack without reading code.

## Architecture (high-level)

```
Browser (Next.js :3000)
   │  REST/JSON + Bearer JWT
   ▼
AssetX Backend (NestJS :3001)
   │  AuthGuard → TenantGuard (RLS) → PermissionGuard
   ▼
PGlite (embedded PostgreSQL, migrations applied at boot)
```

## 1. Prerequisites

- Node.js 20+ (uses 22), npm 10+.

## 2. Environment configuration

### Backend (`backend/`)
Copy `backend/.env.example` to `backend/.env` (or set env vars). Key vars:

| Var | Dev value | Notes |
|---|---|---|
| `PORT` | `3001` | Must differ from web's `3000` |
| `CORS_ORIGIN` | `http://localhost:3000` | Exact web origin(s) in prod, never `*` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | any | **Required in prod** (secret manager) |

### Web (`web/`)
Copy `web/.env.example` to `web/.env.local`. Key vars:

| Var | Dev value | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Backend base URL |
| `NEXT_PUBLIC_AUTH_MODE` | `real` | `real` = backend auth; `mock` = P1 demo only |

## 3. Running

```bash
# Terminal 1 — Backend
cd backend
npm install --legacy-peer-deps
npm run build
PORT=3001 CORS_ORIGIN=http://localhost:3000 node dist/main.js   # → :3001

# Terminal 2 — Web
cd web
npm install
npm run dev   # → :3000
```

Demo credentials (real backend, seeded at boot): `admin` / `AdminPass123` —
**full reference: `docs/DEMO_CREDENTIALS.md`** (role, tenant, mock-mode accounts).

Optional — reproducible **demo dataset** for QA/product preview (assets,
locations, employees, inventory cycle, movements, notifications, audit events):

```bash
ASSETX_SEED_DEMO=1 npm start   # backend → seeds the demo tenant on boot
```

## 4. Authentication flow

1. `POST /auth/login` → `{ accessToken, refreshToken, user }`.
2. Frontend **AuthAdapter** decodes the JWT (roles/permissions/tenant_id) and calls
   `GET /tenant/current` for tenant name/code, then builds a unified `Session`.
3. `SessionProvider` persists the session + tokens and restores it on reload.
4. On reload, if the access token is expired, the app auto-refreshes
   (`POST /auth/refresh`); on failure the session is cleared → redirect to login.
5. Logout calls `POST /auth/logout` (revokes the session server-side) then clears
   local state.

## 5. Session & token management

- Access token + refresh token live in `token-store` (memory + localStorage).
- The API client auto-attaches the Bearer token and performs a **one-time 401
  refresh-retry**.
- **Refresh token rotation:** the backend currently returns a fixed refresh token
  (no rotation). Rotation is planned backend work — do not implement rotation on
  the client without a backend contract change.
- **Storage note:** tokens are stored in `localStorage` (standard for JWT SPAs).
  For higher security requirements, prefer httpOnly cookies on the backend
  (future work) — tokens are never logged.

## 6. Environment matrix

| Env | `AUTH_MODE` | `API_URL` | Notes |
|---|---|---|---|
| Development | `real` (or `mock`) | `http://localhost:3001` | `mock` only for UI-only work |
| Test | `real` | test backend | Integration tests hit real API |
| Production | `real` | prod API | Secrets via secret manager; CORS exact origin |

## 7. Verification

```bash
cd web && npx tsc --noEmit && npx next lint && npm run build
cd backend && npm run build
```

## 8. Security notes (PRE-P3.1)

- Backend enforces Auth + Tenant (RLS) + Permission guards; frontend mirrors with
  `PermissionGate`.
- Error responses are sanitized (no stack leakage) via `HttpExceptionFilter`.
- No sensitive data (password) is persisted client-side.
