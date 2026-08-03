# AssetX Backend — Foundation

NestJS + TypeScript backend for the AssetX Enterprise Platform, following **Clean Architecture / DDD / SOLID**, connected to the verified PostgreSQL schema.

## Architecture

```
src/
├── core/            Domain layer — entities (user/role/permission/tenant), ports (Database, Auth)
├── application/     Services — auth (register/login/logout/refresh/reset), users
├── infrastructure/  PGlite database, bcrypt hasher, JWT token manager, repositories
├── api/             Controllers + DTOs (auth, users, tenant)
├── common/          Guards (auth, rbac, tenant) · decorators · http error filter
├── bootstrap/       Local DB init (applies migration + demo tenant + authenticated role)
├── app.module.ts    Composition root (Clean Architecture wiring via DI tokens)
└── main.ts          Bootstrap
```

**Ports are injected via string tokens** (`DATABASE_PORT`, `PASSWORD_HASHER`, `TOKEN_MANAGER`) so the domain layer depends on abstractions, not infrastructure.

## Database

- Engine: **PGlite** (real PostgreSQL, WASM) locally — swap to Supabase/pg in production.
- The runtime applies `db/migrations/001_init.sql` on boot (24 tables, RLS, computed inventory view).
- **RLS**: the app runs as a non-owner `authenticated` role and sets `app.tenant_id` per request (via `TenantGuard` → `current_tenant_id()`), enforcing tenant isolation (ADR-004).

## Run

```bash
cd backend
npm install
npm run build
npm start            # http://localhost:3000
```

## Test

```bash
NODE_OPTIONS="--experimental-vm-modules" npm test
```

> PGlite uses dynamic WASM imports, so Jest requires `--experimental-vm-modules`.

Tests: unit + integration + API + security, on a real PostgreSQL engine — authentication, RBAC/authorization, and tenant isolation.

## Core Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /auth/register | — | Register user |
| POST | /auth/login | — | Login → JWT pair |
| POST | /auth/logout | Bearer | Revoke session |
| POST | /auth/refresh | — | New access token |
| POST | /auth/reset-password | — | Reset password |
| GET | /users/me | Bearer | Current profile |
| PATCH | /users/profile | Bearer | Update profile |
| GET | /tenant/current | Bearer | Current tenant |

## References

- `../db/migrations/001_init.sql` · `../db/seed/` · `../db/spec/ERD.mmd`
- `Engineering-Specifications/01_Entity_Specifications.md` · `04_Database_Data_Dictionary.md`
- `Security/Security_Architecture.md` · `API/API_Specification.md`
