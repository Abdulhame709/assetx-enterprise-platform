# AssetX README Requirements Gap Analysis — Working Draft

## Source reviewed

The complete `AssetX_README (3).md` was read through line 1791. It defines AssetX as an enterprise fixed-asset lifecycle SaaS platform with web administration, mobile offline-first inventory, QR/barcode scanning, sync/conflict resolution, auditability, API-first design, RBAC, tenant readiness, and a phased roadmap.

## Current repository baseline observed

The repository has a substantial modular-monolith backend with controllers for assets, audit, auth, categories, compliance, dashboard, employees, exports, health, inventory, lifecycle, locations, models, movements, notifications, saved search, search, statuses, tenant, and users. The backend therefore contains more API surface than is exposed in the visible web navigation.

The web navigation exposes Dashboard, Search, Assets, Inventory, Maintenance, Movements, Locations, Asset Types, Reports, Analytics, Compliance, Audit, and Administration. Web route files exist for most of these, including detail routes for assets and inventory. The visible navigation does not yet expose Employees, Attachments, Notifications, Settings as dedicated screens, or the mobile Field Inventory experience.

## Confirmed functional gaps against the README

The README requires a complete Inventory Cycle snapshot workflow, expected/actual values, six computed results, verification/unverification, team assignment, review, close-locking, and field operations. The current web preview only showed an Inventory Cycles shell and no full field/offline workflow.

The README requires QR generation/scanning, offline SQLite, sync upload/download, conflict resolution, device monitoring, GPS, attachments/photos, and mobile-first inventory. These are not yet present as a functioning mobile application in the current repository.

The README requires fine-grained View/Add/Edit/Delete/Print permissions per module and user-level grants. The current project has permission-driven navigation and backend guards, but the full 20-module registry and dedicated Print permission were not confirmed in the visible web UI.

The README requires maintenance, transfers/disposal/retirement, reports with hierarchical filters and preview, employee custody, import jobs with progress and reconciliation, dashboard metrics, depreciation, notifications, settings, and organization management. Some backend controllers exist, but several corresponding dedicated web screens and end-to-end workflows are absent or incomplete.

The README requires Arabic-first multilingual UX. The current i18n provider changes `dir` and `lang` and includes English code labels, but static navigation and page copy are largely hard-coded in English; this explains why RTL works while actual Arabic translation appears incomplete.

## Immediate implementation priorities

1. Replace the current English-only shell labels with a locale-aware dictionary covering navigation, breadcrumbs, common actions, empty states, and status/result labels.
2. Add missing visible tabs/screens for Employees, Notifications, Settings, and Import/Reports where the backend already exposes a capability.
3. Complete the Inventory Cycle workflow before mobile: snapshot creation, cycle state transitions, records, result computation, verification, review, and close lock.
4. Create a mobile/offline architecture package and implement the first vertical slice: campaign selection, local queue, QR scan stub/interface, sync upload/download, and conflict state.
5. Preserve the README as the product source of truth while recording implementation decisions and deliberate deferrals in ADRs.
