# FUNCTIONAL REQUIREMENTS SPECIFICATION (FRS)
## AssetX Enterprise Platform

> **Document ID:** `REQ-FRS-001` | **Version:** 1.0 | **Status:** Approved Baseline
> **Reference:** AAB v6.0 · Master Context Document · PRD · PEP v1.0
> **Path:** `Requirements/Functional_Requirements_Specification.md`

---

## 0. Document Control

| Field | Value |
|---|---|
| **Document Title** | Functional Requirements Specification (FRS) |
| **Document Owner** | Product Owner / BA |
| **Contributors** | Architect, Development, QA, Stakeholders |
| **Authoritative Basis** | AAB v6.0; PRD |
| **Approval Body** | CAB |
| **Classification** | Internal — Confidential |
| **Version** | 1.0 |

---

## 1. Introduction

### 1.1 Purpose

This **Functional Requirements Specification (FRS)** details the **functional behavior** of AssetX at a level suitable for design and test. It expands each PRD epic into concrete functional requirements with acceptance criteria.

### 1.2 Scope

All functional capabilities of the AssetX platform across the approved modules, consistent with the PRD and AAB v6.0.

### 1.3 Requirement Notation

- **FR-<Module>-<NNN>:** functional requirement ID.
- Priority: Must / Should / Could.
- Each FR has: Description, Inputs, Behavior, Outputs, Acceptance Criteria.

---

## 2. Functional Requirements — Module Detail

### 2.1 FR-AUT — Authentication

| ID | Requirement | Priority | Release |
|---|---|---|---|
| `FR-AUT-001` | User signs in with credentials; receives JWT access + refresh token | Must | MVP |
| `FR-AUT-002` | Session refresh via refresh token (7 days) | Must | MVP |
| `FR-AUT-003` | Password hashing via bcrypt/argon2 (cost ≥ 12) | Must | MVP |
| `FR-AUT-004` | MFA-ready (OTP/app) | Could | V2 |
| `FR-AUT-005` | SSO-ready (OAuth2/SAML) | Could | V3 |
| `FR-AUT-006` | Last login tracked per user | Must | MVP |
| `FR-AUT-007` | Lockout/session management & remote revocation | Should | V2 |

**Acceptance (FR-AUT-001):** Given valid credentials, when user submits login, then a JWT pair is returned and a session is created; invalid credentials return a clear error and are audited.

### 2.2 FR-ORG — Organization Management

| ID | Requirement | Priority |
|---|---|---|
| `FR-ORG-001` | Manage organization/branch hierarchy | Must |
| `FR-ORG-002` | Tenant isolation enforced (RLS) | Must |
| `FR-ORG-003` | Organization settings (name, logo) | Must |

### 2.3 FR-ASSET — Asset Management

| ID | Requirement | Priority |
|---|---|---|
| `FR-ASSET-001` | Create asset (name, category, location, status, quantity, price...) | Must |
| `FR-ASSET-002` | Auto-generate Base + Full asset code | Must |
| `FR-ASSET-003` | Edit asset with validation & audit | Must |
| `FR-ASSET-004` | Soft-delete asset (is_active=false) | Must |
| `FR-ASSET-005` | Asset protection checks before delete/edit | Must |
| `FR-ASSET-006` | Generate & print QR/barcode | Must |
| `FR-ASSET-007` | Upload photos/documents (attachments) | Should |
| `FR-ASSET-008` | Smart search across 9 fields | Must |
| `FR-ASSET-009` | Bulk edit (5–11 fields) | Should |
| `FR-ASSET-010` | Duplicate detection (merge/variant/new) | Must |

**Acceptance (FR-ASSET-002):** When creating an asset with a new name, a Base code `YYYY-NNNN` and Full code `Base@Location` are generated uniquely; reused base code for same asset name at new location.

### 2.4 FR-CAT — Asset Categories

| ID | Requirement | Priority |
|---|---|---|
| `FR-CAT-001` | Manage hierarchical categories/types | Must |
| `FR-CAT-002` | Manage sub-types (nested) | Must |
| `FR-CAT-003` | Manage asset models | Must |

### 2.5 FR-LOC — Location Management

| ID | Requirement | Priority |
|---|---|---|
| `FR-LOC-001` | Manage hierarchical locations (building/floor/room/warehouse/workshop/outdoor) | Must |
| `FR-LOC-002` | Parent-child relationship + loop prevention | Must |
| `FR-LOC-003` | Display full path (DisplayName/FullPath/TreeLevel) | Must |
| `FR-LOC-004` | Recursive selection including descendants | Must |
| `FR-LOC-005` | Materialized path storage (LTREE) | Must |

### 2.6 FR-EMP — Employee Management

| ID | Requirement | Priority |
|---|---|---|
| `FR-EMP-001` | Manage employees (custody) | Must |
| `FR-EMP-002` | Link users to employees | Must |
| `FR-EMP-003` | Track custody/employee per asset | Must |

### 2.7 FR-INV — Inventory Campaigns & Cycles

| ID | Requirement | Priority |
|---|---|---|
| `FR-INV-001` | Create inventory cycle (Snapshot of active assets) | Must |
| `FR-INV-002` | Cycle states: New → In Progress → Closed | Must |
| `FR-INV-003` | Closed cycles locked (no record edits) | Must |
| `FR-INV-004` | Inventory team assignment | Must |
| `FR-INV-005` | Six results: Matched/Deficit/Surplus/Transferred/Missing/Not Inventoried | Must |
| `FR-INV-006` | Real-time cycle statistics | Must |
| `FR-INV-007` | Result computed (not stored static) | Must |
| `FR-INV-008` | Print empty inventory form | Should |

**Acceptance (FR-INV-001):** When creating a cycle for a year with active assets, all active assets are copied as Expected records with status "Not Inventoried"; no cycle for same year allowed twice.

### 2.8 FR-FLD — Field Inventory (Offline)

| ID | Requirement | Priority |
|---|---|---|
| `FR-FLD-001` | Work offline (SQLite local) | Must |
| `FR-FLD-002` | Scan QR/barcode to select asset | Must |
| `FR-FLD-003` | Quick Match (one-tap) | Must |
| `FR-FLD-004` | Bulk match by location | Should |
| `FR-FLD-005` | Capture photo | Should |
| `FR-FLD-006` | GPS verification | Should |
| `FR-FLD-007` | Undo inventory record | Must |
| `FR-FLD-008` | Verification (Verify/Unverify/VerifyAll) | Must |
| `FR-FLD-009` | Auto-advance to next record | Should |
| `FR-FLD-010` | Track actual holder during inventory | Should |
| `FR-FLD-011` | Sync queue + conflict resolution | Must |

### 2.9 FR-MOV — Transfers & Disposal

| ID | Requirement | Priority |
|---|---|---|
| `FR-MOV-001` | Log transfers (from/to location, employee, status + reason/ref/approver) | Must |
| `FR-MOV-002` | Disposal: deactivate + status "Damaged" | Must |
| `FR-MOV-003` | Retirement: deactivate + status "Retired" | Must |
| `FR-MOV-004` | Movement history never deleted | Must |
| `FR-MOV-005` | Movement type color coding + filters | Should |

### 2.10 FR-ATT — Attachments

| ID | Requirement | Priority |
|---|---|---|
| `FR-ATT-001` | Upload multiple attachments per asset | Should |
| `FR-ATT-002` | Support photos, invoices, contracts | Should |
| `FR-ATT-003` | Store in Supabase Storage | Should |

### 2.11 FR-RPT — Reporting

| ID | Requirement | Priority |
|---|---|---|
| `FR-RPT-001` | Multi-filter hierarchical reporting | Must |
| `FR-RPT-002` | Recursive location selection (include children) | Must |
| `FR-RPT-003` | Inventory summary by location (expected/actual/diff) | Must |
| `FR-RPT-004` | Export Excel/PDF/CSV/JSON | Must |
| `FR-RPT-005` | Report preview before print | Should |
| `FR-RPT-006` | Scheduled reports | Could |

### 2.12 FR-DSH — Dashboard

| ID | Requirement | Priority |
|---|---|---|
| `FR-DSH-001` | Real-time interactive KPIs | Must |
| `FR-DSH-002` | Asset counts by status/type | Must |
| `FR-DSH-003` | Total value (sum price×qty) | Must |
| `FR-DSH-004` | Current cycle + completion | Must |
| `FR-DSH-005` | Recent movements | Must |
| `FR-DSH-006` | Distribution charts + heat map | Should |

### 2.13 FR-NTF — Notifications

| ID | Requirement | Priority |
|---|---|---|
| `FR-NTF-001` | Push (FCM) notifications | Should |
| `FR-NTF-002` | Email notifications | Should |
| `FR-NTF-003` | WhatsApp notifications | Could |
| `FR-NTF-004` | Template + channel management | Should |

### 2.14 FR-AI — AI Assistant

| ID | Requirement | Priority |
|---|---|---|
| `FR-AI-001` | Smart search (AI L1) | Could (V3) |
| `FR-AI-002` | Duplicate detection (ML/trigram) | Could (V3) |
| `FR-AI-003` | Anomaly detection | Could (V3) |
| `FR-AI-004` | NL report generation | Could (V3) |
| `FR-AI-005` | Image comparison (L2) | Could (V4) |
| `FR-AI-006` | Predictive maintenance (L3) | Could (V5) |

### 2.15 FR-ADM — Administration & Security

| ID | Requirement | Priority |
|---|---|---|
| `FR-ADM-001` | RBAC roles + per-user granular permissions | Must |
| `FR-ADM-002` | Per-module permissions (View/Add/Edit/Delete/Print) | Must |
| `FR-ADM-003` | User management (soft delete + revoke perms) | Must |
| `FR-ADM-004` | Settings as key-value store | Must |
| `FR-ADM-005` | Backup (scheduled, auto-named, restore) | Must |
| `FR-ADM-006` | Audit log viewer with filters | Must |

### 2.16 FR-SYN — Offline Sync Engine

| ID | Requirement | Priority |
|---|---|---|
| `FR-SYN-001` | Local change queue | Must |
| `FR-SYN-002` | Incremental sync | Must |
| `FR-SYN-003` | Conflict resolution (LWW + manual) | Must |
| `FR-SYN-004` | Sync monitoring (status/pending/failed/conflicts) | Must |
| `FR-SYN-005` | Device management (register/revoke) | Must |

---

## 3. Functional Requirements — Cross-Cutting

### 3.1 Audit (by Design)

| ID | Requirement | Priority |
|---|---|---|
| `FR-AUD-001` | Every sensitive operation logged (append-only) | Must |
| `FR-AUD-002` | Audit record: ActionType, TableName, RecordID, UserID, Date, Details, IP | Must |
| `FR-AUD-003` | Audit immutable (7 years retention) | Must |

### 3.2 Security (by Design)

| ID | Requirement | Priority |
|---|---|---|
| `FR-SEC-001` | Least privilege enforced | Must |
| `FR-SEC-002` | Input validation (Zod) | Must |
| `FR-SEC-003` | Rate limiting | Must |
| `FR-SEC-004` | Encryption at rest + in transit | Must |

### 3.3 Internationalization (i18n)

| ID | Requirement | Priority |
|---|---|---|
| `FR-I18N-001` | Arabic + English support | Should |
| `FR-I18N-002` | RTL/LTR layout support | Should |

---

## 4. User Stories & Acceptance Examples

| User Story | Acceptance Criteria (Key) |
|---|---|
| As a field agent, I want to count assets offline | Records save locally, queue pending, sync on reconnect, reflect in statistics |
| As an asset manager, I want to generate QR | QR prints with full code; scanning opens asset |
| As an auditor, I want to review discrepancies | Filter by result, add notes, verify/unverify, approve |

---

## 5. Traceability

| Artifact | Traced To |
|---|---|
| Each FR | PRD epic (`E-NN`), business rule (BR), AAB module, test case |
| Each acceptance criterion | QA test case (§ Testing/Test_Strategy.md) |

> A full requirements traceability matrix (RTM) is maintained in the project tracker linking FR → Design → Test → Build.

---

## 6. Assumptions & Constraints

- FRs must not contradict AAB v6.0 or the approved stack.
- Priority may change only via Product Owner + change management.
- New FRs follow the change management process (PEP §24).

---

## 7. References

| Reference | Location |
|---|---|
| PRD | Requirements/Product_Requirements_Document.md |
| NFR | Requirements/Non_Functional_Requirements.md |
| AAB v6.0 | AssetX-Architecture-Bible/ |
| Test Strategy | Testing/Test_Strategy.md |

---

## 8. Document Control (Closure)

| Field | Value |
|---|---|
| **Status** | Approved Baseline |
| **Approved By** | CAB |

> **End of FRS.**
