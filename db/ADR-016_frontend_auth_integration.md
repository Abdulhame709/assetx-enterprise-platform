# ADR-016 — Frontend Authentication Integration (PRE-P3.1)

**Status:** Approved
**Date:** 2026-08-05
**Deciders:** Principal Software Architect, Staff Frontend Engineer, Security Reviewer
**Related:** ADR-004 (RLS) · ADR-009 (Authorization) · Phase PRE-P3.1

---

## Context

The AssetX frontend previously ran on a **mock runtime** (fake auth, fake data).
To move to a real enterprise application, the frontend had to authenticate against
the real backend and present real tenant/permission/session context — **without**
forcing a backend contract change.

The backend `POST /auth/login` returns:
`{ accessToken, refreshToken, user: { id, username, tenant_id } }`
where the JWT payload carries `roles`, `permissions`, `tenant_id`.

The frontend `Session` type expects: `{ user, tenant, permissions, accessToken, refreshToken }`.

## Decision

Adopt a **Frontend Adapter approach** — no backend changes:

1. After `POST /auth/login`, decode the JWT payload (base64url) to extract
   `sub` (user id), `tenant_id`, `roles`, `permissions`.
2. Call `GET /tenant/current` to fetch tenant `name`/`code`.
3. Build a unified `Session` via `buildSessionFromPayload` in `auth-adapter.ts`.
4. Persist tokens in a `token-store` (memory + `localStorage`).
5. The API client auto-attaches the Bearer token and performs a one-time 401
   refresh-retry via `POST /auth/refresh`.
6. On page reload, restore the session; if the access token is expired
   (`isTokenExpired`), auto-refresh; on failure clear and redirect to login.

### Storage & token-lifecycle decisions
- **JWT in localStorage** — standard for SPA JWT auth. Noted trade-off: XSS could
  read tokens; for higher-security deployments, prefer **httpOnly cookies** (future).
- **No refresh-token rotation on the client** — the backend currently returns a
  fixed refresh token. Rotation must be implemented backend-side first; the client
  must not assume rotation.
- **Logout** calls `POST /auth/logout` (revokes the server session) then clears
  local state.

## Consequences

**Positive**
- Real authentication/authorization/tenant/session with zero backend changes.
- Backward compatible with the existing backend contract.
- Session recovery + automatic refresh on expiry improve UX and correctness.

**Negative / trade-offs**
- Client-side JWT decode trusts the token issuer (backend) — fine since the token
  is verified server-side on every request.
- Tokens in `localStorage` are exposed to XSS (mitigated by CSP + sanitized errors;
  httpOnly-cookie migration is a documented future improvement).

## Verification
- Real end-to-end: login → tenant/current → assets/analytics/lifecycle on a live
  backend; invalid/no token → 401; refresh after same-session logout →
  `SESSION_REVOKED`.
- Frontend unit tests (Vitest) for JWT decode, expiry, and permission matching.
