# DATABASE DATA DICTIONARY
## AssetX Enterprise Platform — Column-Level Engineering Reference

> **Document ID:** `DOC-24` (`ES-04`) | **Version:** 1.0 | **Status:** Approved Baseline
> **Package:** Engineering Specifications — Document 04
> **Reference:** DDS (DOC-09) · Entity Spec (DOC-21) · Security (DOC-13) · Business Rules Catalog (DOC-22) · Decision Log (DOC-19) · AAB §13.15
> **Path:** `Engineering-Specifications/04_Database_Data_Dictionary.md`

---

## 0. Document Control

| Field | Value |
|---|---|
| **Document Title** | Database Data Dictionary |
| **Document Owner** | Senior Solution Architect / Data Engineer |
| **Contributors** | Backend Lead, Security, QA |
| **Authoritative Basis** | DDS (table/column structure) |
| **Review Body** | TRB |
| **Approval Body** | CAB |
| **Classification** | Internal — Confidential |
| **Version** | 1.0 |

### Revision History

| Version | Date | Author | Change Summary | Approved By |
|---|---|---|---|---|
| 1.0 | 2026-08-03 | Architect | Initial baseline — column-level dictionary | CAB (pending) |

---

## 1. Introduction

### 1.1 Purpose

This is the **column-level engineering reference** for the AssetX database. It enriches DDS (which is table-level) with per-column metadata: type, nullability, default, keys, constraints, indexes, RLS, PII classification, entity/rule mapping, and legacy mapping. It enables developers, DBAs, QA, and AI agents to build against the schema **without assumptions**.

### 1.2 Positioning & Rules

- **Reference:** DDS is authoritative for tables/columns/types. This document is an **extension**, not a rewrite.
- **No new tables/columns** are introduced beyond DDS.
- **Pending decisions** are referenced by `ADL-*`, never resolved.
- **No existing document is modified.**

---

## 2. Conventions & Standard Audit Columns

### 2.1 Standard Audit Columns (every business table)

| FLD ID | Column | Type | Null | Default | PK/FK | Unique | PII | Notes |
|---|---|---|---|---|---|---|---|---|
| `FLD-STD-ID` | `id` | UUID | No | — | PK | Yes | — | Technical ID (ADR-001) |
| `FLD-STD-TENANT` | `tenant_id` | UUID | No | — | FK→tenants | — | — | RLS scope |
| `FLD-STD-CREATEDAT` | `created_at` | TIMESTAMPTZ | No | now() | — | — | — | |
| `FLD-STD-UPDATEDAT` | `updated_at` | TIMESTAMPTZ | No | now() | — | — | — | |
| `FLD-STD-CREATEDBY` | `created_by` | UUID | Yes | — | FK→users | — | — | |
| `FLD-STD-UPDATEDBY` | `updated_by` | UUID | Yes | — | FK→users | — | — | |
| `FLD-STD-ISACTIVE` | `is_active` | BOOLEAN | No | true | — | — | — | Soft delete |

> These 7 columns apply to every business table. The dictionary below documents only the **non-standard** columns in detail, with standard columns implied per this table.

### 2.2 Column Dictionary Fields

Each column is described by: **FLD ID · Name · Type · Null · Default · PK/FK · Unique · Index · Description · Entity Attribute · BR Mapping · Validation · PII · Security · Audit Flag · Legacy Field**.

---

## 3. Table Overviews & Column Dictionaries

### 3.1 TB-TENANT — `tenants`

**Overview:**

| Field | Value |
|---|---|
| Table ID | `TB-TENANT` |
| Purpose | Tenant (subscribing organization) isolation root |
| Entity | `ENT-TENANT` |
| Bounded Context | `BC-IDENTITY` |
| Aggregate | `ENT-TENANT` (root) |
| Security Scope | System-level (platform admin) |
| RLS | Managed by platform admin; no tenant RLS on tenant itself |

**Columns (non-standard):**

| FLD | Column | Type | Null | Default | PK/FK | Unique | Index | Description | PII | Legacy |
|---|---|---|---|---|---|---|---|---|---|---|
| `FLD-TENANT-CODE` | `tenant_code` | TEXT | No | — | — | Yes | B-Tree | Business code | — | — |
| `FLD-TENANT-NAME` | `tenant_name` | TEXT | No | — | — | — | — | Tenant name | — | — |
| `FLD-TENANT-STATUS` | `status` | TEXT | No | `active` | — | — | — | Draft/Active/Suspended/Retired | — | — |

> BR: none specific · Entity attr: Tenant.name/code · PII: none · Audit: lifecycle changes (ADL: multi-tenant pending = `ADL-004`).

---

### 3.2 TB-ORGANIZATION — `organizations`

**Overview:**

| Field | Value |
|---|---|
| Table ID | `TB-ORGANIZATION` |
| Purpose | Organizational subdivision within a tenant |
| Entity | `ENT-ORG` |
| Bounded Context | `BC-IDENTITY` |
| Aggregate | member of `ENT-TENANT` |
| RLS | `tenant_id` scoped |

**Columns (non-standard):**

| FLD | Column | Type | Null | Default | PK/FK | Unique | Index | Description | PII | Legacy |
|---|---|---|---|---|---|---|---|---|---|---|
| `FLD-ORG-NAME` | `name` | TEXT | No | — | — | — | — | Org name | — | — |
| `FLD-ORG-PARENT` | `parent_id` | UUID | Yes | — | FK(self) | — | — | Parent org (hierarchy) | — | — |

> Entity attr: Organization.name · PII: none · ADL: none.

---

### 3.3 TB-USER — `users`

**Overview:**

| Field | Value |
|---|---|
| Table ID | `TB-USER` |
| Purpose | System user accounts |
| Entity | `ENT-USER` |
| Bounded Context | `BC-IDENTITY` |
| Aggregate | `ENT-USER` (root) |
| RLS | `tenant_id` scoped |

**Columns (non-standard):**

| FLD | Column | Type | Null | Default | PK/FK | Unique | Index | Description | BR | PII | Legacy |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `FLD-USER-EMP` | `employee_id` | UUID | Yes | — | FK→employees | — | — | Linked employee | — | — | `tblUsers.EmployeeID` |
| `FLD-USER-USERNAME` | `username` | TEXT | No | — | — | Yes | B-Tree | Login name | — | — | `tblUsers.Username` |
| `FLD-USER-EMAIL` | `email` | TEXT | Yes | — | — | — | — | Email | — | Confidential | `tblUsers.Email` |
| `FLD-USER-PW` | `password_hash` | TEXT | No | — | — | — | — | bcrypt/argon2 hash | BR-SEC-005 | — | `tblUsers.PasswordHash` |
| `FLD-USER-LASTLOGIN` | `last_login` | TIMESTAMPTZ | Yes | — | — | — | — | Last login | — | — | `tblUsers.LastLogin` |
| `FLD-USER-ACTIVE` | `is_active` | BOOLEAN | No | true | — | — | partial | Soft delete / disable | BR-SEC-005 | — | `tblUsers.IsActive` |

> BR: BR-SEC-005 · FR: FR-AUT-001/003/006, FR-ADM-003 · PII: email=Confidential · ADL: permission model `ADL-005`.

---

### 3.4 TB-ROLE — `roles`

**Overview:** Table ID `TB-ROLE` · Entity `ENT-ROLE` · BC `BC-IDENTITY` · RLS tenant-scoped.

**Columns:**

| FLD | Column | Type | Null | PK/FK | Unique | Description |
|---|---|---|---|---|---|---|
| `FLD-ROLE-NAME` | `name` | TEXT | No | — | Yes | Role name |
| `FLD-ROLE-DESC` | `description` | TEXT | Yes | — | — | Role description |
| `FLD-ROLE-TYPE` | `role_type` | TEXT | Yes | — | — | Admin/Manager/Auditor/Field Agent |

> BR: BR-SEC-005 · ADL: `ADL-005`.

---

### 3.5 TB-PERMISSION — `permissions`

**Overview:** Table ID `TB-PERMISSION` · Entity `ENT-PERMISSION` · BC `BC-IDENTITY` · RLS tenant-scoped.

**Columns:**

| FLD | Column | Type | Null | PK/FK | Unique | Description |
|---|---|---|---|---|---|---|
| `FLD-PERM-MODULE` | `module_name` | TEXT | No | — | Yes | Module (MOD-*) |
| `FLD-PERM-VIEW` | `can_view` | BOOLEAN | No | false | — | View |
| `FLD-PERM-ADD` | `can_add` | BOOLEAN | No | false | — | Add |
| `FLD-PERM-EDIT` | `can_edit` | BOOLEAN | No | false | — | Edit |
| `FLD-PERM-DELETE` | `can_delete` | BOOLEAN | No | false | — | Delete |
| `FLD-PERM-PRINT` | `can_print` | BOOLEAN | No | false | — | Print (5th — ADL-005) |

> ADL: `ADL-005` (4 vs 5 permissions) — `can_print` documented as present but Pending.

---

### 3.6 TB-ROLE-PERMISSION — `role_permissions`

**Overview:** Join Role↔Permission · RLS tenant-scoped.

**Columns:** `role_id` (FK, UNIQUE with permission_id), `permission_id` (FK).

> Composite `UNIQUE(role_id, permission_id)`.

---

### 3.7 TB-USER-ROLE — `user_roles`

**Overview:** Join User↔Role · RLS tenant-scoped.

**Columns:** `user_id` (FK, UNIQUE with role_id), `role_id` (FK).

---

### 3.8 TB-USER-PERMISSION — `user_permissions`

**Overview:** Per-user granular grants (AAB §13.5) · Entity `ENT-PERMISSION` · RLS tenant-scoped.

**Columns:**

| FLD | Column | Type | Null | PK/FK | Unique | Description |
|---|---|---|---|---|---|---|
| `FLD-UP-USER` | `user_id` | UUID | No | FK→users | Yes* | User |
| `FLD-UP-MODULE` | `module_name` | TEXT | No | — | Yes* | Module |
| `FLD-UP-VIEW/ADD/EDIT/DELETE/PRINT` | can_* | BOOLEAN | No | — | — | granular rights |

> `UNIQUE(user_id, module_name)` · ADL: `ADL-005`.

---

### 3.9 TB-CATEGORY — `asset_categories`

**Overview:** Table ID `TB-CATEGORY` · Entity `ENT-CATEGORY` · BC `BC-ASSET` · RLS tenant-scoped.

**Columns:**

| FLD | Column | Type | Null | PK/FK | Unique | Description |
|---|---|---|---|---|---|---|
| `FLD-CAT-NAME` | `name` | TEXT | No | — | Yes | Category name |
| `FLD-CAT-PARENT` | `parent_id` | UUID | Yes | FK(self) | — | Parent (nested) |
| `FLD-CAT-PATH` | `full_path` | TEXT | Yes | — | — | Materialized path |
| `FLD-CAT-LEVEL` | `level_number` | INT | Yes | — | — | Depth |

> Entity attr: Category.name/parent · PII: none.

---

### 3.10 TB-ASSET-MODEL — `asset_models`

**Overview:** Entity `ENT-MODEL` · BC `BC-ASSET` · RLS tenant-scoped.

**Columns:**

| FLD | Column | Type | Null | PK/FK | Unique | Description |
|---|---|---|---|---|---|---|
| `FLD-MODEL-CAT` | `category_id` | UUID | No | FK→asset_categories | — | Category |
| `FLD-MODEL-SUBTYPE` | `sub_type_id` | UUID | Yes | FK | — | Sub-type |
| `FLD-MODEL-NAME` | `name` | TEXT | No | — | Yes | Model name |

---

### 3.11 TB-STATUS — `statuses`

**Overview:** Entity `ENT-STATUS` · BC `BC-ASSET` · RLS tenant-scoped.

**Columns:**

| FLD | Column | Type | Null | PK/FK | Unique | Description |
|---|---|---|---|---|---|---|
| `FLD-STATUS-NAME` | `name` | TEXT | No | — | Yes | Status name |
| `FLD-STATUS-COLOR` | `color` | TEXT | Yes | — | — | StatusColor (hex) |

---

### 3.12 TB-LOCATION — `locations`

**Overview:** Table ID `TB-LOCATION` · Entity `ENT-LOCATION` · BC `BC-LOCATION` · Aggregate `ENT-LOCATION` (root) · RLS tenant-scoped.

**Columns:**

| FLD | Column | Type | Null | PK/FK | Unique | Index | Description | Legacy |
|---|---|---|---|---|---|---|---|---|
| `FLD-LOC-PARENT` | `parent_id` | UUID | Yes | FK(self) | — | — | Parent location | `tblSubLocations.ParentSubLocationID` |
| `FLD-LOC-NAME` | `name` | TEXT | No | — | — | — | Location name | `SubLocationName` |
| `FLD-LOC-TYPE` | `location_type` | TEXT | No | — | — | — | building/room/warehouse/workshop/outdoor | — |
| `FLD-LOC-PATH` | `path` | LTREE | No | — | — | GIN | Materialized path (ADR-005) | `FullPath` |
| `FLD-LOC-FULLPATH` | `full_path` | TEXT | No | — | — | — | Display name | `FullPath` |
| `FLD-LOC-LEVEL` | `level_number` | INT | No | — | — | — | Tree level | `LevelNumber` |

> ADL: `ADL-004` (legacy FullPath mapping Pending) · BR: — · PII: none.

---

### 3.13 TB-ASSET — `assets` (central) ⭐

**Overview:**

| Field | Value |
|---|---|
| Table ID | `TB-ASSET` |
| Purpose | Central asset registry |
| Entity | `ENT-ASSET` |
| Bounded Context | `BC-ASSET` |
| Aggregate | `ENT-ASSET` (root) |
| RLS | `tenant_id` scoped |

**Columns (non-standard):**

| FLD | Column | Type | Null | Default | PK/FK | Unique | Index | Description | BR | PII | Legacy |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `FLD-ASSET-NAME` | `name` | TEXT | No | — | — | — | — | Asset name (min 2) | BR-ASSET-002 | — | `tblAssets.AssetName` |
| `FLD-ASSET-BASECODE` | `base_asset_code` | TEXT | No | — | — | — | B-Tree | `YYYY-NNNN` | BR-CODE-001 | — | `BaseAssetCode` |
| `FLD-ASSET-FULLCODE` | `full_asset_code` | TEXT | No | — | — | Yes | B-Tree | `Base@Location` | BR-ASSET-001/CODE-001 | — | `FullAssetCode` |
| `FLD-ASSET-DESC` | `description` | TEXT | Yes | — | — | — | — | Description | — | — | `Description` |
| `FLD-ASSET-CAT` | `category_id` | UUID | No | — | FK→categories | — | — | Category | BR-ASSET-002 | — | `AssetTypeID` |
| `FLD-ASSET-SUBTYPE` | `sub_type_id` | UUID | Yes | — | FK | — | — | Sub-type | — | — | `SubTypeID` |
| `FLD-ASSET-MODEL` | `model_id` | UUID | Yes | — | FK→models | — | — | Model | — | — | `ModelID` |
| `FLD-ASSET-LOC` | `location_id` | UUID | No | — | FK→locations | — | — | Location | BR-ASSET-002 | — | `MainLocationID/SubLocationID` |
| `FLD-ASSET-QTY` | `quantity` | INT | No | 1 | — | — | — | Qty > 0 | BR-ASSET-002 | — | `Quantity` |
| `FLD-ASSET-STATUS` | `status_id` | UUID | No | — | FK→statuses | — | — | Status | BR-ASSET-002 | — | `StatusID` |
| `FLD-ASSET-EMP` | `employee_id` | UUID | Yes | — | FK→employees | — | — | Custodian | — | — | `EmployeeID` |
| `FLD-ASSET-PRICE` | `purchase_price` | DECIMAL(18,2) | No | 0 | — | — | — | ≥ 0 | — | — | `PurchasePrice` |
| `FLD-ASSET-PDATE` | `purchase_date` | DATE | Yes | — | — | — | — | Purchase date | — | — | `PurchaseDate` |
| `FLD-ASSET-DEPRATE` | `depreciation_rate` | DECIMAL(5,2) | Yes | — | — | — | — | 0–100 | — | — | `DepreciationRate` |
| `FLD-ASSET-LIFE` | `useful_life` | INT | Yes | — | — | — | — | ≥ 0 | — | — | `UsefulLife` |
| `FLD-ASSET-SERIAL` | `serial_number` | TEXT | Yes | — | — | — | — | Serial | — | Internal | `SerialNumber` |
| `FLD-ASSET-BARCODE` | `barcode` | TEXT | Yes | — | — | — | — | Barcode | — | — | `Barcode` |
| `FLD-ASSET-REF` | `reference_number` | TEXT | Yes | — | — | — | — | Reference | — | — | `ReferenceNumber` |
| `FLD-ASSET-INVYEAR` | `inventory_year` | INT | Yes | — | — | — | — | Inventory year | — | — | `InventoryYear` |
| `FLD-ASSET-NOTES` | `notes` | TEXT | Yes | — | — | — | — | Notes | — | — | `Notes` |
| `FLD-ASSET-ACTIVE` | `is_active` | BOOLEAN | No | true | — | — | partial | Soft delete | BR-ASSET-010 | — | `IsActive` |

> Indexes: B-Tree `full_asset_code`, `base_asset_code`, `tenant_id`; partial `is_active`. · ADL: `ADL-003` (code model) · PII: serial=Internal.

---

### 3.14 TB-EMPLOYEE — `employees`

**Overview:** Table ID `TB-EMPLOYEE` · Entity `ENT-EMPLOYEE` · BC `BC-EMPLOYEE` · Aggregate `ENT-EMPLOYEE` · RLS tenant-scoped.

**Columns:**

| FLD | Column | Type | Null | PK/FK | Description | PII | Legacy |
|---|---|---|---|---|---|---|---|
| `FLD-EMP-NAME` | `name` | TEXT | No | — | Employee name | Confidential | `tblEmployees.Name` |
| `FLD-EMP-DEPT` | `department` | TEXT | Yes | — | Department | — | — |
| `FLD-EMP-PHONE` | `phone` | TEXT | Yes | — | Phone | Restricted | — |
| `FLD-EMP-EMAIL` | `email` | TEXT | Yes | — | Email | Confidential | — |

> PII: name=Confidential, phone=Restricted, email=Confidential (`ADL-009`).

---

### 3.15 TB-MOVEMENT — `asset_movements`

**Overview:** Table ID `TB-MOVEMENT` · Entity `ENT-MOVEMENT` · BC `BC-MOVEMENT` · Aggregate `ENT-MOVEMENT` · RLS tenant-scoped · **append-only**.

**Columns:**

| FLD | Column | Type | Null | PK/FK | Description | BR |
|---|---|---|---|---|---|---|
| `FLD-MOV-ASSET` | `asset_id` | UUID | No | FK→assets | Asset | BR-MOV-001 |
| `FLD-MOV-TYPE` | `movement_type` | TEXT | No | — | Transfer/Disposal/Retirement | — |
| `FLD-MOV-FROMLOC` | `from_location_id` | UUID | Yes | FK→locations | From location | — |
| `FLD-MOV-TOLOC` | `to_location_id` | UUID | Yes | FK→locations | To location | — |
| `FLD-MOV-FROMEMP` | `from_employee_id` | UUID | Yes | FK→employees | From holder | — |
| `FLD-MOV-TOEMP` | `to_employee_id` | UUID | Yes | FK→employees | To holder | — |
| `FLD-MOV-FROMSTAT` | `from_status_id` | UUID | Yes | FK→statuses | From status | — |
| `FLD-MOV-TOSTAT` | `to_status_id` | UUID | Yes | FK→statuses | To status | — |
| `FLD-MOV-REASON` | `reason` | TEXT | Yes | — | Reason | — |
| `FLD-MOV-REF` | `reference_number` | TEXT | Yes | — | Reference | — |
| `FLD-MOV-APPROVER` | `approved_by` | UUID | Yes | FK→users | Approver | — |
| `FLD-MOV-QTY` | `quantity` | INT | Yes | — | Qty | — |
| `FLD-MOV-NOTES` | `notes` | TEXT | Yes | — | Notes | — |
| `FLD-MOV-ACTOR` | `performed_by` | UUID | Yes | FK→users | Performer | — |

> BR: BR-MOV-001/004 (immutable) · append-only — no DELETE.

---

### 3.16 TB-MAINTENANCE — `maintenance_orders`

**Overview:** Table ID `TB-MAINTENANCE` · Entity `ENT-MAINTENANCE` · BC `BC-MAINTENANCE` · RLS tenant-scoped.

**Columns:**

| FLD | Column | Type | Null | PK/FK | Description | BR |
|---|---|---|---|---|---|---|
| `FLD-MNT-ASSET` | `asset_id` | UUID | No | FK→assets | Asset | BR-MNT-002 |
| `FLD-MNT-CODE` | `maintenance_code` | TEXT | Yes | — | Code | — |
| `FLD-MNT-TYPE` | `maintenance_type` | TEXT | Yes | — | Type | — |
| `FLD-MNT-COST` | `cost` | DECIMAL(18,2) | Yes | — | Cost | — |
| `FLD-MNT-TECH` | `technician_name` | TEXT | Yes | — | Technician | — |
| `FLD-MNT-TECHCONTACT` | `technician_contact` | TEXT | Yes | — | Contact | Restricted |
| `FLD-MNT-START` | `start_date` | DATE | Yes | — | Start | — |
| `FLD-MNT-END` | `end_date` | DATE | Yes | — | End | — |
| `FLD-MNT-NEXT` | `next_maintenance_date` | DATE | Yes | — | Next | — |
| `FLD-MNT-STATUS` | `status_id` | UUID | Yes | FK→statuses | Status | BR-MNT-002 |
| `FLD-MNT-PRIORITY` | `priority` | TEXT | Yes | — | Priority | — |

---

### 3.17 TB-CYCLE — `inventory_cycles`

**Overview:** Table ID `TB-CYCLE` · Entity `ENT-CYCLE` · BC `BC-INVENTORY` · Aggregate `ENT-CYCLE` (root) · RLS tenant-scoped.

**Columns:**

| FLD | Column | Type | Null | PK/FK | Unique | Description | BR | Legacy |
|---|---|---|---|---|---|---|---|---|
| `FLD-CYCLE-YEAR` | `year` | INT | No | — | Yes* | Cycle year | BR-INV-001 | `tblInventoryCycles.CycleYear` |
| `FLD-CYCLE-STATUS` | `status` | TEXT | No | `new` | — | New/InProgress/Closed | BR-INV-002 | — |
| `FLD-CYCLE-START` | `start_date` | DATE | Yes | — | — | Start | — | — |
| `FLD-CYCLE-END` | `end_date` | DATE | Yes | — | — | End | — | — |

> `UNIQUE(tenant_id, year)` — per-tenant (ADL-008). Legacy global UNIQUE on CycleYear → **per-tenant pending** (`ADL-008`).

---

### 3.18 TB-RECORD — `inventory_records` (expected/actual)

**Overview:** Table ID `TB-RECORD` · Entity `ENT-RECORD` · BC `BC-INVENTORY` · RLS tenant-scoped.

**Columns:**

| FLD | Column | Type | Null | PK/FK | Unique | Description | BR | Legacy |
|---|---|---|---|---|---|---|---|---|
| `FLD-REC-CYCLE` | `cycle_id` | UUID | No | FK→cycles | Yes* | Cycle | BR-INV-001 | `tblInventoryRecords.CycleID` |
| `FLD-REC-ASSET` | `asset_id` | UUID | No | FK→assets | Yes* | Asset | — | `AssetID` |
| `FLD-REC-EXP-LOC` | `expected_location_id` | UUID | Yes | FK→locations | — | Expected location | — | `ExpectedMainLocID/SubLocID` |
| `FLD-REC-EXP-QTY` | `expected_quantity` | INT | Yes | — | — | Expected qty | — | `ExpectedQuantity` |
| `FLD-REC-EXP-STATUS` | `expected_status_id` | UUID | Yes | FK→statuses | — | Expected status | — | `ExpectedStatusID` |
| `FLD-REC-EXP-EMP` | `expected_employee_id` | UUID | Yes | FK→employees | — | Expected holder | — | `ExpectedEmployeeID` |
| `FLD-REC-ACT-LOC` | `actual_location_id` | UUID | Yes | FK→locations | — | Actual location | — | `ActualMainLocID/SubLocID` |
| `FLD-REC-ACT-QTY` | `actual_quantity` | INT | Yes | — | — | Actual qty | — | `ActualQuantity` |
| `FLD-REC-ACT-STATUS` | `actual_status_id` | UUID | Yes | FK→statuses | — | Actual status | — | `ActualStatusID` |
| `FLD-REC-ACT-EMP` | `actual_employee_id` | UUID | Yes | FK→employees | — | Actual holder | — | `ActualEmployeeID` |
| `FLD-REC-RESULT` | `result` | TEXT | Yes | — | — | Computed result (ADL-006) | BR-INV-002 | `InventoryResult` |
| `FLD-REC-DATE` | `inventory_date` | DATE | Yes | — | — | Inventory date | — | `InventoryDate` |
| `FLD-REC-BY` | `inventory_by` | UUID | Yes | FK→users | — | Who counted | — | `InventoryBy` |
| `FLD-REC-VERIFIED` | `is_verified` | BOOLEAN | No | false | — | Verified | BR-INV-003 | `IsVerified` |
| `FLD-REC-VERIFIEDBY` | `verified_by` | UUID | Yes | FK→users | — | Who verified | — | `VerifiedBy` |
| `FLD-REC-VERIFIEDDATE` | `verified_date` | TIMESTAMPTZ | Yes | — | — | When | — | `VerifiedDate` |
| `FLD-REC-NOTES` | `notes` | TEXT | Yes | — | — | Notes | — | `Notes` |

> `UNIQUE(cycle_id, asset_id)`. · **Result computed vs stored → `ADL-006` Pending** (documented as computed).

---

### 3.19 TB-TEAM — `inventory_team`

**Overview:** Entity `ENT-TEAM` · BC `BC-INVENTORY` · RLS tenant-scoped.

**Columns:**

| FLD | Column | Type | Null | PK/FK | Unique | Description |
|---|---|---|---|---|---|---|
| `FLD-TEAM-CYCLE` | `cycle_id` | UUID | No | FK→cycles | Yes* | Cycle |
| `FLD-TEAM-EMP` | `employee_id` | UUID | No | FK→employees | Yes* | Member |
| `FLD-TEAM-ROLE` | `team_role` | TEXT | No | — | — | Role (default 'member') |

> `UNIQUE(cycle_id, employee_id)`.

---

### 3.20 TB-AUDIT — `audit_events`

**Overview:** Table ID `TB-AUDIT` · Entity `ENT-AUDIT` · BC `BC-AUDIT` · RLS tenant-scoped · **append-only immutable**.

**Columns:**

| FLD | Column | Type | Null | PK/FK | Description |
|---|---|---|---|---|---|
| `FLD-AUDIT-USER` | `user_id` | UUID | Yes | FK→users | Actor |
| `FLD-AUDIT-ACTION` | `action_type` | TEXT | No | — | Action |
| `FLD-AUDIT-TABLE` | `table_name` | TEXT | No | — | Table |
| `FLD-AUDIT-RECORD` | `record_id` | TEXT | No | — | Record |
| `FLD-AUDIT-DETAILS` | `details` | JSONB | Yes | — | Details |
| `FLD-AUDIT-IP` | `ip_address` | TEXT | Yes | — | IP |
| `FLD-AUDIT-FP` | `device_fingerprint` | TEXT | Yes | — | Device |
| `FLD-AUDIT-GEO` | `geo` | TEXT | Yes | — | Geo |
| `FLD-AUDIT-UA` | `user_agent` | TEXT | Yes | — | UA |
| `FLD-AUDIT-TS` | `created_at` | TIMESTAMPTZ | No | — | Timestamp |

> Immutable; retention 7 years (NFR-CMP-006). Partitioned by time/tenant.

---

### 3.21 TB-NOTIFICATION — `notifications`

**Overview:** Entity `ENT-NOTIFICATION` · BC `BC-NOTIFICATION` · RLS tenant-scoped.

**Columns:**

| FLD | Column | Type | Null | PK/FK | Description |
|---|---|---|---|---|---|
| `FLD-NOTIF-USER` | `user_id` | UUID | No | FK→users | Recipient |
| `FLD-NOTIF-TEMPLATE` | `template_id` | UUID | Yes | FK→templates | Template |
| `FLD-NOTIF-CHANNEL` | `channel` | TEXT | No | — | push/email/whatsapp |
| `FLD-NOTIF-STATUS` | `status` | TEXT | No | — | queued/sent/read |
| `FLD-NOTIF-PAYLOAD` | `payload` | JSONB | Yes | — | Data |

---

### 3.22 TB-NOTIF-TEMPLATE — `notification_templates`

**Columns:** `name` (TEXT, unique), `subject` (TEXT), `body` (TEXT).

---

### 3.23 TB-NOTIF-CHANNEL — `notification_channels`

**Columns:** `name` (TEXT, unique), `config` (JSONB).

---

### 3.24 TB-SETTINGS — `settings`

**Overview:** Entity `ENT-SETTINGS` · BC `BC-CONFIG` · RLS tenant-scoped.

**Columns:**

| FLD | Column | Type | Null | PK/FK | Unique | Description |
|---|---|---|---|---|---|---|
| `FLD-SET-KEY` | `setting_key` | TEXT | No | — | Yes | Key |
| `FLD-SET-VALUE` | `setting_value` | TEXT/JSONB | Yes | — | — | Value |

---

### 3.25 TB-SAVED-SEARCH — `saved_searches` (ADR-011)

**Overview:** Table ID `TB-SAVED-SEARCH` · Entity `ENT-SAVED-SEARCH` · BC `BC-SEARCH` · RLS tenant + user scoped.

**Columns:**

| FLD | Column | Type | Null | Default | PK/FK | Unique | Index | Description |
|---|---|---|---|---|---|---|---|---|
| `FLD-SS-ID` | `id` | UUID | No | gen_random_uuid() | PK | Yes | — | Technical ID |
| `FLD-SS-TENANT` | `tenant_id` | UUID | No | — | FK→tenants | — | B-Tree | RLS scope |
| `FLD-SS-USER` | `user_id` | UUID | No | — | FK→users | — | B-Tree | Owner |
| `FLD-SS-NAME` | `name` | TEXT | No | — | — | Yes (per user) | — | ≤ 80 chars |
| `FLD-SS-RESOURCE` | `resource` | TEXT | No | — | — | — | B-Tree | assets/movements/audit |
| `FLD-SS-FILTERS` | `filters` | JSONB | No | — | — | — | — | persisted SearchQuery filters (≤ 4KB) |
| `FLD-SS-DEFAULT` | `is_default` | BOOLEAN | No | false | — | partial (per user) | — | max 1 per user |
| `FLD-SS-VERSION` | `version` | INT | No | 1 | — | — | — | filter-schema version (ADR-011 §4) |
| `FLD-SS-CREATEDAT` | `created_at` | TIMESTAMPTZ | No | now() | — | — | — | |
| `FLD-SS-UPDATEDAT` | `updated_at` | TIMESTAMPTZ | No | now() | — | — | — | |

> Constraints: `UNIQUE(tenant_id, user_id, name)`; partial index on `is_default` per user. RLS enabled (tenant isolation via `current_tenant_id()`); user ownership enforced in service layer.

---

## 4. Data Classification Matrix

Per Security (DOC-13) and AAB §11W:

| Classification | Definition | AssetX Data Examples |
|---|---|---|
| **Public** | No sensitivity | Reference data, status names |
| **Internal** | Internal to organization | Asset names, codes, categories, locations |
| **Confidential** | Restricted, encrypted | User email, employee name, settings |
| **Restricted (PII)** | Highest sensitivity | Employee phone, technician contact, high-value asset |

### 4.1 Column → Classification

| Classification | Columns |
|---|---|
| Public | statuses.name, categories.name, reference data |
| Internal | asset codes, names, quantities, location full_path |
| Confidential | users.email, employees.name, employees.email, settings values |
| Restricted | employees.phone, maintenance.technician_contact |

---

## 5. RLS Data Access Mapping

| Data | Tenant Scope | User | Role | Scope |
|---|---|---|---|---|
| Business tables | `tenant_id` | Session user | RBAC per module | `WHERE tenant_id = current_tenant_id()` |
| `tenants` | platform admin | platform role | admin | platform scope |
| `users` | tenant | self + admin | admin | tenant-scoped |
| `audit_events` | tenant | admin/auditor | audit | tenant-scoped |
| `settings` | tenant | admin | admin | tenant-scoped |

> RLS policy model per ADR-004. Tests verify no cross-tenant leakage (NFR-SEC-006).

---

## 6. Entity-to-Database Mapping

| Entity (ENT) | Table (TB) | Key Fields (FLD) |
|---|---|---|
| ENT-TENANT | TB-TENANT | FLD-TENANT-CODE, NAME |
| ENT-ORG | TB-ORGANIZATION | FLD-ORG-NAME, PARENT |
| ENT-USER | TB-USER | FLD-USER-USERNAME, EMAIL |
| ENT-ROLE | TB-ROLE | FLD-ROLE-NAME |
| ENT-PERMISSION | TB-PERMISSION | FLD-PERM-* |
| ENT-ASSET | TB-ASSET | FLD-ASSET-FULLCODE, NAME, QTY |
| ENT-CATEGORY | TB-CATEGORY | FLD-CAT-NAME |
| ENT-MODEL | TB-ASSET-MODEL | FLD-MODEL-NAME |
| ENT-STATUS | TB-STATUS | FLD-STATUS-NAME |
| ENT-LOCATION | TB-LOCATION | FLD-LOC-PATH, NAME |
| ENT-EMPLOYEE | TB-EMPLOYEE | FLD-EMP-NAME |
| ENT-MOVEMENT | TB-MOVEMENT | FLD-MOV-ASSET, TYPE |
| ENT-MAINTENANCE | TB-MAINTENANCE | FLD-MNT-ASSET |
| ENT-CYCLE | TB-CYCLE | FLD-CYCLE-YEAR |
| ENT-RECORD | TB-RECORD | FLD-REC-CYCLE, ASSET, RESULT |
| ENT-TEAM | TB-TEAM | FLD-TEAM-CYCLE, EMP |
| ENT-AUDIT | TB-AUDIT | FLD-AUDIT-ACTION |
| ENT-NOTIFICATION | TB-NOTIFICATION | FLD-NOTIF-USER, CHANNEL |
| ENT-SETTINGS | TB-SETTINGS | FLD-SET-KEY |
| ENT-SAVED-SEARCH | TB-SAVED-SEARCH | FLD-SS-NAME, FLD-SS-RESOURCE |

---

## 7. Legacy Migration Mapping

| Legacy Table (tbl*) | Legacy Column | New Table | New Column |
|---|---|---|---|
| tblUsers | UserID | users | id |
| tblUsers | Username | users | username |
| tblUsers | EmployeeID | users | employee_id |
| tblAssets | AssetID | assets | id |
| tblAssets | AssetName | assets | name |
| tblAssets | BaseAssetCode | assets | base_asset_code |
| tblAssets | FullAssetCode | assets | full_asset_code |
| tblAssets | AssetTypeID | assets | category_id |
| tblAssets | MainLocationID/SubLocationID | assets | location_id |
| tblAssets | StatusID | assets | status_id |
| tblAssets | EmployeeID | assets | employee_id |
| tblAssets | PurchasePrice | assets | purchase_price |
| tblAssets | DepreciationRate | assets | depreciation_rate |
| tblAssets | IsActive | assets | is_active |
| tblSubLocations | ParentSubLocationID | locations | parent_id |
| tblSubLocations | FullPath | locations | path/full_path |
| tblSubLocations | LevelNumber | locations | level_number |
| tblInventoryCycles | CycleYear | inventory_cycles | year |
| tblInventoryRecords | CycleID/AssetID | inventory_records | cycle_id/asset_id |
| tblInventoryRecords | InventoryResult | inventory_records | result (computed) |
| tblInventoryRecords | IsVerified | inventory_records | is_verified |

> Legacy is a **knowledge source** (AAB §11M); mapping enables migration. Pending: `ADL-004` (location path), `ADL-006` (result computed).

---

## 8. Traceability Matrix

| Element | Type | Links |
|---|---|---|
| TB-ASSET | Table | ENT-ASSET · BR-ASSET-001/002/009/010, BR-CODE-001 · FR-ASSET-* · NFR-PRF-002 · EP-ASSET-* · Security: soft-delete, RLS |
| TB-RECORD | Table | ENT-RECORD · BR-INV-001/002/003 · FR-INV-*, FR-FLD-* · NFR-PRF-004 · ADL-006 |
| TB-CYCLE | Table | ENT-CYCLE · BR-INV-001/002 · FR-INV-* · ADL-008 |
| TB-USER | Table | ENT-USER · BR-SEC-005 · FR-AUT-*, FR-ADM-* · Security: hashing, MFA |
| TB-AUDIT | Table | ENT-AUDIT · FR-AUD-* · NFR-CMP-006 · Security: append-only |

> Full per-column traceability is available in each table's dictionary above.

---

## 9. Recommendations

| Recommendation | Reason | Priority |
|---|---|---|
| Implement `result` as computed DB view/API (not stored) when ADL-006 is approved | Keeps result synchronized | High (pending ADL-006) |
| Add `TB-DEVICE` when offline sync is specified | Field devices need a table | Medium (see ES-11) |
| Apply RLS isolation tests across all tenant-scoped tables | Prevent data leakage | High |
| Partition `audit_events` and `inventory_records` for scale | Performance at enterprise scale | Medium |

## 10. Decision Log Proposals

| Proposal | Topic | Status |
|---|---|---|
| `ADL-PROP-004` | Confirm the column-level taxonomy (PII/security/audit flags) as canonical | Pending |
| `ADL-PROP-005` | Confirm per-tenant UNIQUE(tenant_id, year) for cycles (ADL-008) | Pending |

---

## 11. Document Control (Closure)

| Field | Value |
|---|---|
| **Status** | Approved Baseline |
| **Reviewed By** | TRB |
| **Approved By** | CAB (pending) |
| **Next Document** | `Offline Synchronization Specification` (sequence step 2) |

> **End of Database Data Dictionary.**
