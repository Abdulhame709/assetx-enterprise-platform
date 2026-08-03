# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## AssetX Enterprise Platform

> **Document ID:** `REQ-PRD-001` | **Version:** 1.0 | **Status:** Approved Baseline
> **Reference:** AssetX Architecture Bible (AAB) v6.0 · Master Context Document · PEP v1.0
> **Path:** `Requirements/Product_Requirements_Document.md`

---

## 0. Document Control

| Field | Value |
|---|---|
| **Document Title** | AssetX Product Requirements Document (PRD) |
| **Document Owner** | Product Owner (PO) |
| **Contributors** | Senior Solution Architect, Technical Program Manager, Stakeholders |
| **Authoritative Basis** | AAB v6.0 (Single Source of Truth); Master Context Document |
| **Review Body** | TRB (architecture impact) |
| **Approval Body** | CAB |
| **Classification** | Internal — Confidential |
| **Effective Date** | 2026-08-03 |

### Revision History

| Version | Date | Author | Change Summary | Approved By |
|---|---|---|---|---|
| 0.1 | 2026-08-03 | PO | Initial draft | — |
| 1.0 | 2026-08-03 | PO | Approved baseline | CAB |

---

## 1. Introduction

### 1.1 Purpose

This **Product Requirements Document (PRD)** defines **what AssetX is** and the **product-level requirements** (business, user, functional intent, and non-functional intent) that guide design, build, and acceptance. It is the product-level anchor between the **Architecture Bible (how)** and the **Functional Requirements Specification (detailed behavior)**.

### 1.2 Scope

The PRD covers the **AssetX Enterprise Platform**: Web Administration Portal + Mobile Field Application, delivering full fixed-asset lifecycle management with offline-first smart field inventory. It describes the product's purpose, target users, value, features (epic-level), priorities, and release intent — aligned with the approved roadmap (MVP → V6+).

### 1.3 Intended Audience

Product Owners, Engineering Leads, UX/UI designers, QA, DevOps, stakeholders, and the Architecture Team.

---

## 2. Product Overview

### 2.1 Product Summary

AssetX is an **enterprise SaaS platform** for the **complete lifecycle of fixed assets** — from acquisition through custody, transfer, maintenance, inventory, depreciation, and disposal — with a strategic differentiator in **offline-first smart field inventory** on mobile/tablet.

### 2.2 Product Positioning

| Dimension | Statement |
|---|---|
| **For** | Organizations managing large fixed-asset portfolios (government, education, healthcare, industry, commercial) |
| **Who** | Need a unified asset database and efficient, reliable field inventory |
| **The (product)** | AssetX is an enterprise asset lifecycle + smart field inventory platform |
| **That** | Works offline-first, is cloud-native, multi-tenant-ready, and AI-enabled |
| **Unlike** | Spreadsheets, paper forms, or limited inventory apps |
| **Our product** | Delivers end-to-end lifecycle management with smart, offline field operations |

### 2.3 Key Differentiators

- **Offline First:** full field operation without internet, then sync.
- **Mobile Native:** first-class field experience.
- **Authentic Arabic:** native Arabic-first with i18n.
- **AI Built-in:** search, duplicate detection, anomaly, image comparison, predictive (tiered).
- **Enterprise & SaaS:** multi-tenant-ready, governed, observable, scalable.

---

## 3. Target Users & Personas

### 3.1 Personas (from AAB §02/§15)

| Persona | Role | Needs | Platform |
|---|---|---|---|
| **Administrator** | System admin | User/roles/permissions, settings, backup | Web |
| **Asset Manager** | Asset custodian | Register/edit assets, track movement, QR | Web |
| **Auditor** | Compliance reviewer | Review assets, reports, discrepancies, verify | Web |
| **Department Manager** | Unit manager | Department assets, reports | Web |
| **Inventory Team / Field Agent** | Field counter | Offline field counting, QR scanning, photos | Mobile |
| **Maintenance** | Technician | Maintenance orders | Web |
| **Employee** | Asset holder | View own assets only | Web/Mobile |

### 3.2 User Journey Highlights (from AAB §11H)

**Asset Manager:** Login → Dashboard → Create Campaign → Monitor → Review → Approve → Report.
**Field Agent:** Open offline → Select campaign → Scan QR → Confirm → Photo → Save → Sync.
**Auditor:** Login → Review → Filter discrepancies → Verify → Notes → Approve.

---

## 4. Goals, Objectives & Success Metrics

### 4.1 Product Goals

| Code | Goal | Maps to |
|---|---|---|
| `PG-01` | Reduce annual inventory time by ≥ 70% | BO-001 |
| `PG-02` | Reduce human inventory errors | BO-002 |
| `PG-03` | Unify asset data | BO-003 |
| `PG-04` | Provide complete asset history | BO-004 |
| `PG-05` | Enable offline inventory | BO-005 |
| `PG-06` | Provide real-time dashboards | BO-006 |
| `PG-07` | Enterprise-grade scalability & SaaS readiness | BO-007 |

### 4.2 Success Metrics (Product Level)

| Metric | Target |
|---|---|
| Inventory campaign duration | ≥ 70% reduction |
| % assets inventoried | ≥ 95% |
| Discrepancy detection | Automated + reported |
| Offline sync completion | 100% no data loss |
| Uptime (MVP) | 99.5% |
| User satisfaction | ≥ 80% |

---

## 5. Scope

### 5.1 In-Scope (Product Level)

- Full asset lifecycle management.
- Hierarchical location management.
- Employee & custody management.
- Inventory cycles (snapshot model) + field inventory (offline).
- QR/barcode generation & scanning.
- RBAC + granular permissions + audit.
- Reporting + dashboards.
- Notifications.
- AI assistant (tiered).
- Multi-tenant-ready SaaS architecture.
- Enterprise governance (Maker-Checker, SoD, approval) — later versions.

### 5.2 Out-of-Scope (Early Versions)

- Inventory/stock management, vehicle fleet, contracts.
- Full ERP.
- IoT, NFC/Beacon hardware, voice (early).
- Subscription/billing (V4+).
- Third-party integrations (V3/V4).

---

## 6. Functional Requirements (Epic Level)

> Detailed behavior lives in the **Functional Requirements Specification (FRS)**. This section lists product-level epics with priority.

| ID | Epic | Description | Priority | Release |
|---|---|---|---|---|
| `E-01` | Authentication | Sign-in, session, MFA-ready, SSO-ready | Must | MVP |
| `E-02` | Organization Management | Organization/branch structure | Must | MVP |
| `E-03` | Asset Management | CRUD, codes, QR, photos, soft-delete | Must | MVP |
| `E-04` | Asset Categories | Hierarchical categories/types | Must | MVP |
| `E-05` | Location Management | Hierarchical locations | Must | MVP |
| `E-06` | Employee Management | Employees & custody | Must | MVP |
| `E-07` | Inventory Campaigns | Cycles, snapshot, teams | Must | MVP |
| `E-08` | Field Inventory | Offline counting, QR, photos, GPS | Must | V2 |
| `E-09` | Asset Transfers | Transfer/disposal/retirement | Should | V2 |
| `E-10` | Attachments | Photos/documents | Should | V2 |
| `E-11` | Reporting | Reports, export, preview | Must | MVP |
| `E-12` | Dashboard | Real-time KPIs | Must | MVP |
| `E-13` | Notifications | Push/email/WhatsApp | Should | V2 |
| `E-14` | AI Assistant | Search, anomaly, image, predictive | Could | V3+ |
| `E-15` | Administration | RBAC, settings, backup | Must | MVP |
| `E-16` | Audit Logs | Append-only audit | Must | MVP |
| `E-17` | Offline Sync Engine | Sync queue, conflict resolution | Must | V2 |

### 6.1 Prioritization Legend

- **Must:** required for MVP.
- **Should:** high value, planned for V2.
- **Could:** valuable but deferrable (V3+).

---

## 7. Key Product Rules (High-Level)

> Business Rules (BR) are authoritative in AAB §13.1; the PRD references key ones.

| Rule | Statement |
|---|---|
| `BR-ASSET-001` | Every asset has a unique identifier (never repeats). |
| `BR-ASSET-002` | An asset requires name, category, location, status to be created. |
| `BR-ASSET-010` | Soft Delete instead of physical delete. |
| `BR-INV-001` | Creating an inventory cycle copies all active assets (Snapshot). |
| `BR-INV-002` | A closed cycle accepts no further record edits. |
| `BR-SEC-005` | Users receive only the permissions required (Least Privilege). |

---

## 8. Business Rules by Module (Summary)

| Module | Key Business Rules (Summary) |
|---|---|
| Asset | Unique code; mandatory fields; soft-delete; asset protection checks |
| Code Generation | Base code + full code; auto sequence; gap reuse |
| Movement | Transfers logged as independent movements; never deleted |
| Maintenance | Status auto-changes when maintenance starts |
| Inventory | Snapshot on cycle creation; closed cycles locked; result computed |
| Permissions | Per-module View/Add/Edit/Delete/Print; per-user grants |
| Security | bcrypt/argon2 hashing; JWT; least privilege; immutable audit |

---

## 9. Non-Functional Requirements (Summary)

> Detailed NFRs in the **Non-Functional Requirements** document and AAB §11B.

| Category | Key Targets |
|---|---|
| Performance | Dashboard < 2s; Search < 500ms; List(10K) < 1s; Sync ≥ 1000 rec/min; QR < 300ms |
| Availability | MVP SLA 99.5%; Enterprise 99.9% |
| Scalability | MVP 10K assets/100 users; Enterprise 10M/10K |
| Security | OWASP ASVS L2; AES-256; TLS 1.3; bcrypt cost ≥ 12; JWT 15min/refresh 7d |
| Usability | Arabic-first; responsive; keyboard shortcuts; dark mode |
| Compliance | GDPR-ready; data retention policies |

---

## 10. Release Intent (Roadmap)

| Release | Product Intent |
|---|---|
| **MVP** | Core platform: assets, locations, employees, inventory foundation, RBAC, audit, dashboards, reporting, QR generation |
| **V2** | Field inventory + governance: offline mobile, sync, QR scanning, GPS, advanced reporting, Maker-Checker |
| **V3** | AI + analytics: AI L1, audit intelligence, maintenance + depreciation, transfers/disposal |
| **V4** | SaaS + enterprise: multi-tenant full, subscription, integration hub, AI L2 |
| **V5** | Advanced: AI L3, NFC/Beacon/IoT/PWA |
| **V6+** | Enterprise operating model: ops, observability, SecOps, DR, governance |

---

## 11. Assumptions, Constraints, Dependencies

### 11.1 Assumptions
- AAB v6.0 remains authoritative.
- Approved tech stack remains baseline.
- Legacy system data available as knowledge source.
- Offline-first achievable with SQLite + sync queue.

### 11.2 Constraints
- Architecture = Enterprise; implementation = incremental.
- Design both platforms; implement Web first.
- Mandatory document order; domain drives database.
- Non-negotiable product principles (AAB §5).
- Approved technology stack.

### 11.3 Dependencies
- Schema/migrations → Web modules.
- REST APIs → Mobile.
- Auth → all modules.
- Observability → ops dashboards.
- AI L1 data → AI L2/L3.

---

## 12. Stakeholders & Approval

| Stakeholder | Role in Requirements |
|---|---|
| Product Owner | Owns and prioritizes |
| Solution Architect | Ensures alignment with AAB |
| TPM | Schedule/risk |
| Development | Feasibility, effort |
| QA | Testability |
| SecOps | Security requirements |
| End Users | UAT validation |

---

## 13. References

| Reference | Location |
|---|---|
| AAB v6.0 | AssetX-Architecture-Bible/ |
| Master Context Document | AssetX_README (3).md |
| PEP v1.0 | Execution/Project_Execution_Plan.md |
| FRS | Requirements/Functional_Requirements_Specification.md |
| NFR | Requirements/Non_Functional_Requirements.md |

---

## 14. Document Control (Closure)

| Field | Value |
|---|---|
| **Status** | Approved Baseline |
| **Next Document (related)** | Functional Requirements Specification |
| **Approved By** | CAB |

> **End of PRD.**
