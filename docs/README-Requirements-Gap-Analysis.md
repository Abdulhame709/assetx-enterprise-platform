# AssetX README Requirements Gap Analysis — Working Draft

## Source reviewed

The complete `AssetX_README (3).md` was reviewed together with the functional, mobile, UI/UX, entity, business-rule, API, database, operations, delivery, and project-tracking Markdown documents. AssetX is an enterprise fixed-asset lifecycle platform with Arabic-first web administration and offline-first field inventory, QR/barcode scanning, sync/conflict resolution, auditability, API-first design, RBAC, and tenant isolation.

## Current repository baseline observed

The repository has a substantial modular-monolith backend with controllers for assets, audit, auth, categories, compliance, dashboard, employees, exports, health, inventory, lifecycle, locations, models, movements, notifications, saved search, search, statuses, tenant, and users. The backend therefore contains more API surface than is exposed in the visible web navigation.

The web navigation exposes Dashboard, Search, Assets, Inventory, Maintenance, Movements, Locations, Asset Types, Reports, Analytics, Compliance, Audit, and Administration. Web route files exist for most of these, including detail routes for assets and inventory. The visible navigation does not yet expose Employees, Attachments, Notifications, Settings as dedicated screens, or the mobile Field Inventory experience.

## Confirmed functional gaps against the README

The README requires a complete Inventory Cycle snapshot workflow, expected/actual values, six computed results, verification/unverification, team assignment, review, close-locking, and field operations. The current web preview only showed an Inventory Cycles shell and no full field/offline workflow.

The README requires QR generation/scanning, offline SQLite, sync upload/download, conflict resolution, device monitoring, GPS, attachments/photos, and mobile-first inventory. The first AssetX Mobile slice now supplies local SQLite storage, a persisted queue, QR scanning, cycle downloads, and queued count uploads; it does not yet model a location-first work session, bulk match, structured transfer proposal, device management, GPS, or attachments.

The README requires fine-grained View/Add/Edit/Delete/Print permissions per module and user-level grants. The current project has permission-driven navigation and backend guards, but the full 20-module registry and dedicated Print permission were not confirmed in the visible web UI.

The README requires maintenance, transfers/disposal/retirement, reports with hierarchical filters and preview, employee custody, import jobs with progress and reconciliation, dashboard metrics, depreciation, notifications, settings, and organization management. Some backend controllers exist, but several corresponding dedicated web screens and end-to-end workflows are absent or incomplete.

The README requires Arabic-first multilingual UX. The shell and selected asset/inventory pages now use the locale dictionary, but `AssetFormModal` still hard-codes its visible labels, validation messages, placeholders, modal title, and actions in English. The generated base/full asset code is returned by the create API but the modal closes before presenting it clearly to the user.

## Confirmed requirements from the current review

| Requirement | Canonical source | Current gap | Required implementation decision |
|---|---|---|---|
| Arabic-first asset creation | FRS `FR-I18N-001/002`; UX §9 | Add-asset modal remains English in Arabic mode | Route every visible form string through `useI18n()` and preserve direction-aware inputs. |
| Visible asset business code | README §11J, §13.12f; FRS `FR-ASSET-002` | Code is generated but not shown within the create completion flow | Keep the modal in a success state after create and display `full_asset_code` plus `base_asset_code`, with copy/open actions. |
| Location-first field inventory | README §13.3, §13.10; FRS `FR-FLD-003/004`; UX §6 | Mobile lists a flat cycle snapshot and requires manual counting | Select a current physical location first, then show only expected records in that location (optionally including descendants). |
| Uncounted assets remain actionable | README §13.2/§13.3; FRS `FR-INV-005` | No dedicated location-level uncounted queue | Display an explicit `لم يُجرد` section per current location until each record is counted, skipped, or moved to another work location. |
| Cross-location discovery is not a silent transfer | README §13.4, §13.12d; FRS `FR-MOV-001`; BR-MOV-001 | Location mismatch is currently serialized as a free-text note | Record actual location for the inventory result and, only after field confirmation, create a pending movement proposal subject to the existing approval workflow. |

## Immediate implementation priorities

1. Complete Arabic translation and generated-code confirmation in the asset-creation workflow.
2. Add stable expected/actual location identifiers to the mobile snapshot and local model; display names are insufficient for a secure transfer proposal.
3. Implement a location work session with quick match, batch match, uncounted records, auto-advance, undo, and result filtering.
4. Add a structured, approval-gated transfer proposal from field inventory. It must create a pending movement and never silently overwrite the master asset location.
5. Preserve the README as the product source of truth while recording implementation decisions and deliberate deferrals in ADRs.
