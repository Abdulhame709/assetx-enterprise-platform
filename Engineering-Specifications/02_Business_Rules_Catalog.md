# BUSINESS RULES CATALOG
## AssetX Enterprise Platform

> **Document ID:** `DOC-22` (`ES-02`) | **Version:** 1.0 | **Status:** Approved Baseline
> **Package:** Engineering Specifications — Document 02 (DDD sequence step 1)
> **Reference:** AAB v6.0 §13.1 (canonical) · FRS (DOC-06) · Entity Spec (DOC-21) · Architecture Index (DOC-20) · Decision Log (DOC-19)
> **Path:** `Engineering-Specifications/02_Business_Rules_Catalog.md`

---

## 0. Document Control

| Field | Value |
|---|---|
| **Document Title** | Business Rules Catalog |
| **Document Owner** | Senior Solution Architect / Product Owner |
| **Contributors** | Backend Lead, QA Lead |
| **Authoritative Basis** | AAB v6.0 §13.1 (canonical source of BR definitions) |
| **Review Body** | TRB |
| **Approval Body** | CAB |
| **Classification** | Internal — Confidential |
| **Version** | 1.0 |

### Revision History

| Version | Date | Author | Change Summary | Approved By |
|---|---|---|---|---|
| 1.0 | 2026-08-03 | Architect | Initial baseline — BR catalog with enforcement mapping | CAB (pending) |

---

## 1. Introduction

### 1.1 Purpose

This catalog is the **authoritative index of AssetX business rules** and — critically — maps **each rule to its enforcement point** (where it is applied in the system). It does **not** redefine rules (AAB §13.1 is canonical); it adds the **engineering enforcement mapping** that developers, QA, and AI agents need to implement rules correctly.

### 1.2 Scope & Positioning

This is a **Business Rules Catalog**, not:
- A Validation Rules spec (ES — Validation Rules defines field-level validation, a subset).
- A Database spec (DDS).
- A Workflow spec (ES — Workflow defines flows that trigger rules).

Rules are referenced by `BR-*` ID. New catalog-level IDs introduced here are **enforcement points**, not redefinitions.

---

## 2. BR Inventory (from AAB §13.1 — canonical)

The canonical definitions live in AAB §13.1. This catalog references them and adds the enforcement mapping.

| BR ID | Rule (canonical, AAB §13.1) | Domain | Related Entity |
|---|---|---|---|
| `BR-ASSET-001` | Every asset must have a unique identifier (never repeats). | Asset | ENT-ASSET |
| `BR-ASSET-002` | An asset cannot be created without: name, category, location, status. | Asset | ENT-ASSET |
| `BR-ASSET-009` | Physical delete is not allowed if the asset has movements/maintenance. | Asset | ENT-ASSET |
| `BR-ASSET-010` | Soft Delete is used instead of physical delete. | Asset | ENT-ASSET |
| `BR-CODE-001` | Asset code is auto-generated (Prefix + Sequence): Base Code + Full Code. | Code | ENT-ASSET |
| `BR-MOV-001` | Any asset transfer is recorded as an independent movement. | Movement | ENT-MOVEMENT |
| `BR-MOV-004` | A movement record is never deleted (audit trail). | Movement | ENT-MOVEMENT |
| `BR-MNT-002` | When maintenance starts, the asset status changes automatically. | Maintenance | ENT-MAINTENANCE |
| `BR-SEC-005` | Each user receives only the permissions required for their work (Least Privilege). | Identity | ENT-USER/PERMISSION |
| `BR-INV-001` | Creating an inventory cycle automatically copies all active assets (Snapshot). | Inventory | ENT-CYCLE |
| `BR-INV-002` | A closed cycle accepts no modification to its inventory records. | Inventory | ENT-CYCLE/RECORD |
| `BR-INV-003` | A record that was not inventoried cannot be verified. | Inventory | ENT-RECORD |

---

## 3. Enforcement Mapping (New Engineering Knowledge)

Each rule is enforced at one or more of these layers. This mapping is the **value-add** of this catalog.

### 3.1 Enforcement Layers

| Layer | Code | Description |
|---|---|---|
| **API middleware** | `ENF-API` | Authorization/validation guard at request boundary (NestJS guard). |
| **Service layer** | `ENF-SVC` | Application/business-logic service enforcement. |
| **Domain layer** | `ENF-DOM` | Domain invariant enforced inside aggregate. |
| **Database constraint** | `ENF-DB` | DB-level constraint (UNIQUE, NOT NULL, CHECK, trigger). |
| **DB view / computed** | `ENF-VIEW` | Computed/derived value (inventory result). |
| **UI** | `ENF-UI` | Frontend/mobile validation (UX guard; not authoritative). |

### 3.2 BR → Enforcement Mapping

| BR ID | Primary Enforcement | Secondary | Notes |
|---|---|---|---|
| `BR-ASSET-001` | `ENF-DB` (UNIQUE full_asset_code) | `ENF-SVC` | Code uniqueness enforced at DB + validated at service. |
| `BR-ASSET-002` | `ENF-API` (validation guard) | `ENF-UI` | Required fields validated at API; UI guides. |
| `BR-ASSET-009` | `ENF-SVC` (asset protection check) | `ENF-DB` | Protection check in service before delete/edit. |
| `BR-ASSET-010` | `ENF-SVC` (soft delete) | `ENF-DB` (`is_active`) | Soft delete via `is_active=false`. |
| `BR-CODE-001` | `ENF-SVC` (code generator) | `ENF-DB` (sequence) | Code generation in service; sequence table in DB. |
| `BR-MOV-001` | `ENF-SVC` (log movement) | — | Transfer logged as movement. |
| `BR-MOV-004` | `ENF-DB` (append-only / no delete) | `ENF-SVC` | Movement records immutable. |
| `BR-MNT-002` | `ENF-SVC` (status transition) | — | Status auto-update on maintenance start. |
| `BR-SEC-005` | `ENF-API` (RBAC guard) | `ENF-DOM` | Least privilege enforced at API + domain. |
| `BR-INV-001` | `ENF-SVC` (snapshot on create) | `ENF-VIEW` | Cycle creation snapshots active assets. |
| `BR-INV-002` | `ENF-SVC` (cycle lock) | `ENF-DB` (state) | Closed cycle blocks record edits. |
| `BR-INV-003` | `ENF-SVC` (verification guard) | `ENF-UI` | Cannot verify an uninventoried record. |

---

## 4. Business Rule → Module Map

| Module (MOD) | Applicable BRs |
|---|---|
| `MOD-01` Assets | BR-ASSET-001/002/009/010, BR-CODE-001 |
| `MOD-11` TransferAsset | BR-MOV-001 |
| `MOD-12` MovementHistory | BR-MOV-004 |
| Maintenance | BR-MNT-002 |
| `MOD-16` Users | BR-SEC-005 |
| `MOD-08` InventoryCycles | BR-INV-001/002 |
| `MOD-09` InventoryEntry | BR-INV-002 |
| `MOD-10` InventoryReview | BR-INV-003 |

---

## 5. Derived Rules from AAB Algorithms (Reference)

The following are **algorithms/behaviors** defined in AAB §13.12 (not formally `BR-*` coded). They are referenced here as **rule-adjacent behaviors** that implement business logic. No new rule is invented; these are pointers.

| AAB Reference | Behavior | Enforcement | Related BR |
|---|---|---|---|
| §13.12a | Inventory result computed (Matched/Deficit/Surplus/Transferred/Missing/Not Inventoried) | `ENF-VIEW` | BR-INV-001/002 |
| §13.12b | Snapshot algorithm (copy active assets on cycle create) | `ENF-SVC` | BR-INV-001 |
| §13.12c | Asset protection (4 checks before delete/edit) | `ENF-SVC` | BR-ASSET-009 |
| §13.12d | Transfer algorithm (record + update asset + deactivate if disposal) | `ENF-SVC` | BR-MOV-001, BR-ASSET-010 |
| §13.12e | Hierarchical location query (Recursive/CTE → LTREE) | `ENF-DB` | — |
| §13.12f | Code generation (Base + Full, gap reuse) | `ENF-SVC` | BR-CODE-001 |
| §13.12g | Similarity detection (Levenshtein/trigram) | `ENF-SVC` | — |
| §13.12h | Duplicate detection (merge/variant/new) | `ENF-SVC` | — |
| §13.12i | SmartSearch (9 fields) | `ENF-SVC` | — |
| §13.12j | Depreciation calculation | `ENF-SVC` | — |
| §13.12k | Field validation rules | `ENF-API`/`ENF-DB` | BR-ASSET-002 |

---

## 6. Validation Rules (forward reference)

Field-level validation is detailed in the **Validation Rules** Engineering Specification (ES — sequence step 5). This catalog references AAB §13.12k only:

| Field | Rule |
|---|---|
| AssetName | required, ≥ 2 chars |
| AssetTypeID / category | required |
| MainLocationID | required |
| StatusID | required |
| Quantity | > 0 (default 1) |
| PurchasePrice | ≥ 0 |
| DepreciationRate | 0–100 |
| UsefulLife | ≥ 0 |

---

## 7. Traceability

| BR | FR (FRS) | Entity | Enforcement |
|---|---|---|---|
| BR-ASSET-001 | FR-ASSET-002 | ENT-ASSET | ENF-DB/SVC |
| BR-ASSET-002 | FR-ASSET-001 | ENT-ASSET | ENF-API/UI |
| BR-ASSET-009 | FR-ASSET-005 | ENT-ASSET | ENF-SVC |
| BR-ASSET-010 | FR-ASSET-004 | ENT-ASSET | ENF-SVC/DB |
| BR-CODE-001 | FR-ASSET-002 | ENT-ASSET | ENF-SVC |
| BR-MOV-001 | FR-MOV-001 | ENT-MOVEMENT | ENF-SVC |
| BR-MOV-004 | FR-MOV-004 | ENT-MOVEMENT | ENF-DB/SVC |
| BR-MNT-002 | (maintenance) | ENT-MAINTENANCE | ENF-SVC |
| BR-SEC-005 | FR-ADM-001/002 | ENT-USER/PERM | ENF-API/DOM |
| BR-INV-001 | FR-INV-001 | ENT-CYCLE | ENF-SVC/VIEW |
| BR-INV-002 | FR-INV-003 | ENT-CYCLE/RECORD | ENF-SVC/DB |
| BR-INV-003 | FR-INV-007/FLD | ENT-RECORD | ENF-SVC |

---

## 8. Dependencies

- **BR definitions:** AAB §13.1 (canonical) — referenced, not redefined.
- **Related Documents:** FRS (DOC-06), Entity Spec (DOC-21), Validation Rules (ES-05), DDS (DOC-09).
- **Pending decisions:** none block this catalog (all BRs are canonical).

---

## 9. Cross-References

| Document | DOC ID | Relation |
|---|---|---|
| AAB §13.1 | DOC-01 | Canonical BR source |
| Entity Specifications | DOC-21 | Related entities |
| FRS | DOC-06 | FR traceability |
| Validation Rules | ES (step 5) | Field-level validation |
| Architecture Index | DOC-20 | IDs |

---

## 10. Recommendations

| Recommendation | Reason | Priority |
|---|---|---|
| Keep AAB §13.1 as the single canonical source; this catalog only adds enforcement mapping | Avoids rule divergence | High |
| Add a DB trigger (or service hook) enforcing BR-MOV-004 (immutability) | Audit integrity | Medium |

## 11. Decision Log Proposals

| Proposal | Topic | Status |
|---|---|---|
| `ADL-PROP-003` | Confirm the enforcement-layer taxonomy (ENF-API/SVC/DOM/DB/VIEW/UI) as canonical | Pending |

---

## 12. Document Control (Closure)

| Field | Value |
|---|---|
| **Status** | Approved Baseline |
| **Reviewed By** | TRB |
| **Approved By** | CAB (pending) |
| **Next Document** | `03. Workflow Specifications` (sequence step 3; Entity Spec already done) |

> **End of Business Rules Catalog.**
