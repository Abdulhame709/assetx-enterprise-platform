# Dependency Matrix — AssetX

> **Version:** 1.0 | **Status:** Living artifact | **Owner:** TPM
> **Last Updated:** 2026-08-03

Module-level dependencies (finish-to-start unless noted). Drives sequencing and impact analysis.

| Module | Depends on | Needed by |
|---|---|---|
| Database / Schema | — | Everything |
| Authentication | DB | Everything |
| Authorization (RBAC/Permissions) | Auth | All business modules |
| Tenant Isolation (RLS) | DB | All business modules |
| Master Data | DB | Assets, Movements, Inventory, Reporting |
| Assets | Master Data, Auth | Movements, Inventory, Reporting, Export, Search |
| Movements | Assets, Auth | Reporting, Audit, Export |
| Inventory | Assets, Master Data | Reporting, Audit |
| Audit | Auth, DB | Reporting, Security |
| Notifications | Auth, DB | Movements, Inventory, Compliance, Export |
| Realtime (SSE) | Notifications | Frontend |
| Reporting | Assets, Movements, Inventory | Dashboard, Export |
| Export | Reporting, Data | Frontend |
| Search | Data, Repositories | Frontend |
| Saved Searches | Search, DB | Frontend |
| Compliance | Data | Dashboard, Notifications |
| Frontend (Web) | All APIs | Users |
| Frontend (Mobile) | APIs, Offline | Field agents |
| Offline Sync | API, Assets, Inventory | Mobile |

## Dependency rules

- A module cannot be considered **Done** if a dependency is not.
- Cross-module integration is via ports/events — no direct calls across bounded contexts.
- This matrix informs the critical path in Sprint Planning.
