# Technical Debt Register — AssetX

> **Purpose:** Records deferred / intentionally-not-now engineering items so they are not lost. These are **documented only** — not implemented.
> **Owner:** Senior Enterprise Solution Architect / TPM
> **Update cadence:** Each phase completion (as part of Closure Report).

---

## How to read this register

- **Priority:** High / Medium / Low (impact × urgency).
- **Status:** Documented (default) / In-Progress / Done / Rejected.
- Each item states *what* is deferred, *why*, and *what would trigger doing it*.

---

## Export Engine — Deferred Items (Phase 11.3)

| ID | Item | Description | Why deferred | Trigger to implement | Priority |
|---|---|---|---|---|---|
| TD-EXP-001 | **Async Export** | Move export to a background job; return a job id + poll/download endpoint | Current SYNC is fine for ≤10k rows; UI/scale not yet present | >10k rows, slow responses, mobile/web UI demand | High |
| TD-EXP-002 | **Job Queue** | Use BullMQ / Redis queue for export jobs | No queue infra in place; single-process MVP | Async export adopted; concurrency needed | High |
| TD-EXP-003 | **S3 Storage** | Upload generated files to object storage instead of returning inline | No storage layer; inline download suffices | Large files, audit retention of exports, async delivery | Medium |
| TD-EXP-004 | **Email Export** | Email the generated report to a user | No email provider wired; not requested yet | Scheduled reports; user preference | Medium |
| TD-EXP-005 | **Scheduled Export** | Cron-driven periodic exports (daily/weekly) | No scheduler; not requested | Executive reporting cadence | Medium |
| TD-EXP-006 | **Retry Strategy** | Retry + dead-letter for failed async exports | Only relevant for async/queue | Async export (TD-EXP-001/002) | Medium |
| TD-EXP-007 | **Zip Export** | Bundle multiple files into a ZIP | No multi-file use case yet | Multi-resource/batch export | Low |
| TD-EXP-008 | **Compression** | Compress CSV/PDF payloads (gzip) | Adds complexity; not needed at current size | Large responses over low-bandwidth | Low |
| TD-EXP-009 | **Large File Strategy** | True streaming for Excel/PDF (currently buffered) | Library constraint; acceptable at current scale | Files > tens of MB | Medium |
| TD-EXP-010 | **Deprecated Permissions Cleanup** | Remove `report.export`/`audit.export` aliases | Kept to avoid breaking existing tests | After consumers migrate to `export.*` | Low |

---

## Platform-Wide Deferred Items (cross-phase)

| ID | Item | Description | Why deferred | Priority |
|---|---|---|---|---|
| TD-PLT-001 | **Async job infrastructure (BullMQ/Redis)** | Background workers for imports, reports, exports, depreciation | MVP is single-process; no broker yet | High |
| TD-PLT-002 | **Full multi-tenant activation + subscription/billing** | RLS-ready but single tenant in MVP (ADR-004) | Roadmap V4 | Medium |
| TD-PLT-003 | **WebSocket (vs SSE)** | Bidirectional realtime | SSE suffices for 1-way notifications | Low |
| TD-PLT-004 | **Permission version expiry token store** | Currently `settings` table; consider Redis for scale | Adequate for now | Low |
| TD-PLT-005 | **Audit retention/archiving job** | Partition + archive `audit_events` (ADR-010 retention) | Volume not yet large | Medium |
| TD-PLT-006 | **Reporting read-model / materialized views** | For >50k assets performance (ADR note) | Current queries fine | Medium |
| TD-PLT-007 | **Notification templates i18n (locale column)** | Multi-language notifications | Not requested; needs schema decision | Low |
| TD-PLT-008 | **Frontend (Web + Mobile)** | Next.js + Flutter clients | Backend-first roadmap | High |
| TD-PLT-009 | **Production cloud deploy (Supabase/CI-CD/backups)** | Move off local PGlite to managed infra | Not yet in release phase | High |

---

## Rules

- Nothing here is "lost" — every item has a trigger to revisit.
- Items are **documented only** unless explicitly scheduled.
- Revisiting any item requires an ADR / change request (do not silently implement).

---

*Last updated: 2026-08-03 (Phase 11.3 Closure).*
