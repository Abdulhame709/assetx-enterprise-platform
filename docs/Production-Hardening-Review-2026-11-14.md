# Production Hardening Review — 2026-11-14

Scope: what was added so the backend refuses unsafe configuration, survives abusive or oversized input, and queries stay fast as data grows. Delivered in PR [#20](https://github.com/Abdulhame709/assetx-enterprise-platform/pull/20).

## What changed

| Area | Change | Where |
|---|---|---|
| Startup safety | In `NODE_ENV=production` the process **refuses to start** if `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `CORS_ORIGIN` are missing, contain placeholder text (`change-me`, `assetx-local-`, `dev-only`, `replace-me`), the secrets are shorter than 32 characters or identical, `CORS_ORIGIN` is `*`, or `DATABASE_URL` is empty (which would silently fall back to the in-memory dev database). | `backend/src/bootstrap/production-config.ts` |
| Error handling | A global HTTP exception filter returns stable error codes instead of stack traces or raw messages; the web app maps the codes to translated text. | `backend/src/common/http/http-exception.filter.ts`, `web/src/lib/api/errors.ts` |
| Pagination | `page`/`limit` are coerced and clamped (max 500 per page). Exports and repository queries are capped (default 50,000 rows, `EXPORT_MAX_ROWS` to override). | `backend/src/common/utils/pagination.ts` |
| Import limits | Excel import rejects non-ZIP files (`IMPORT_FILE_INVALID`) and sheets over 5,000 data rows (`IMPORT_TOO_MANY_ROWS`) before processing. | `backend/src/application/import-limits.ts` |
| Rate limiting | Global 60 requests/minute per IP, plus a slow 15-minute window on login and reset-password (default 40, `AUTH_THROTTLE_LIMIT`) against patient password spraying. Per-route limits remain for bursts. | `backend/src/common/http/throttle-config.ts` |
| Database | Composite `(tenant_id, …)` indexes on the hot list/filter paths. Idempotent (`IF NOT EXISTS`); rollback statements are in the file header. | `db/migrations/017_production_indexes.sql` |
| Containers | Dockerfiles updated; `.dockerignore` added so local files, tests and secrets are not copied into images. | `backend/Dockerfile`, `web/Dockerfile`, `.dockerignore` |

## Verification

- Backend `tsc` clean; unit tests 138 passed; integration tests 39 suites / 319 tests passed.
- New unit specs cover production-config validation, pagination clamping, import limits and the throttle configuration.

## Before going live (actions for the operator)

1. **Apply migration `017_production_indexes.sql`** to the production database. It only adds indexes (no data is touched); on a very large table run it in a quiet period.
2. **Set real secrets**: two different random values of at least 32 characters for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`, an explicit `CORS_ORIGIN` (comma-separated list, never `*`), and `DATABASE_URL`.
3. **Replace the test admin password** (`admin123123` is for local use only).
4. Keep a verified database backup before the migration and before any bulk import.
5. Put the API behind HTTPS and a reverse proxy; if the proxy is trusted, make sure the client IP is forwarded correctly so per-IP rate limits work.

## Known limits and follow-ups

- Rate-limit counters are in process memory. With several backend instances behind a load balancer each instance counts separately; use a shared store (e.g. Redis) if strict global limits are needed.
- No automated load test is checked in yet. Suggested baseline: login burst (verifies throttling returns 429), `GET /assets?limit=500` under 50 concurrent users, and one 5,000-row import. Record results here when run.
- Axe accessibility audit is clean on the main screens; Movements, Import and Audit pages were fixed but not re-audited, and `/search` and `/analytics` have no sidebar link yet.
