# AssetX Web — Deployment Guide

> Phase PRE-P3.1 — Real Backend & Authentication Integration.

## Deployment topology

```
Web (Next.js, static/standalone)  ──HTTPS──►  Backend (NestJS, :3001)  ──►  Database (PostgreSQL)
        │                                                     │
        │  NEXT_PUBLIC_API_URL (public)                        │  PORT, CORS_ORIGIN, secrets
```

Two deployable units: the **web app** (frontend) and the **backend** (NestJS).

## 1. Build

```bash
# Backend
cd backend
npm ci --legacy-peer-deps
npm run build                    # → dist/

# Web
cd web
npm ci
npm run build                    # → .next/ (standalone) or exported static
```

## 2. Environment (production)

### Backend
| Var | Production value |
|---|---|
| `PORT` | `3001` (or load-balanced port) |
| `CORS_ORIGIN` | exact web origin, e.g. `https://app.assetx.example.com` (never `*`) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | from secret manager (Vault/KMS) — never committed |
| `DATABASE_*` | managed PostgreSQL connection (Supabase/RDS) in production |

### Web
| Var | Production value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.assetx.example.com` |
| `NEXT_PUBLIC_AUTH_MODE` | `real` |

## 3. Run

```bash
# Backend
cd backend && node dist/main.js

# Web (standalone server)
cd web && npm run start
```

For serverless/static hosting (Vercel/Netlify), the web app is built with
`next build`; `NEXT_PUBLIC_*` vars must be set at build time (they are inlined).

## 4. HTTPS & cookies

- Terminate TLS at the load balancer / edge (HTTPS only).
- Currently tokens are stored in `localStorage` (JWT SPA). For higher-security
  deployments, migrate to **httpOnly, Secure, SameSite** cookies on the backend
  (see ADR-016 — documented future work).
- Set a strict **CSP** on the web app to reduce XSS exposure of stored tokens.

## 5. Security checklist (before production cutover)

- [ ] Secrets injected via secret manager; none committed.
- [ ] `CORS_ORIGIN` set to exact origins.
- [ ] HTTPS enforced end-to-end.
- [ ] CSP + security headers configured.
- [ ] Backend Auth/Tenant(RLS)/Permission guards verified.
- [ ] Logging is sanitized (no tokens/passwords in logs).

## 6. Rollback

- **Web:** redeploy previous build artifact; `NEXT_PUBLIC_*` are build-time, so a
  full rebuild is required if they change.
- **Backend:** redeploy previous `dist/`; DB migrations are backward-compatible
  (no destructive changes in PRE-P3.1).
