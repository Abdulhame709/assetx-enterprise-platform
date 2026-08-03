# ADMINISTRATOR GUIDE
## AssetX Enterprise Platform — Administration

> **Document ID:** `ADMIN-GUIDE-001` | **Version:** 1.0 | **Status:** Approved Baseline
> **Reference:** AAB v6.0 (§7, §13.5, §13.6, §15) · FRS (FR-ADM) · Security Architecture
> **Path:** `Administration/Administrator_Guide.md`

---

## 0. Document Control

| Field | Value |
|---|---|
| **Document Title** | Administrator Guide |
| **Document Owner** | Documentation Team / Product |
| **Contributors** | Security, Support, Architecture |
| **Authoritative Basis** | AAB v6.0; FRS (Administration module) |
| **Approval Body** | CAB |
| **Version** | 1.0 |

---

## 1. Introduction

### 1.1 Purpose

This guide provides **system administrators** with the procedures to configure, manage, and maintain the AssetX platform: users, roles, permissions, settings, backups, audit, and monitoring.

### 1.2 Audience

AssetX Administrators (Administrator role) and system administration staff.

---

## 2. Getting Started

### 2.1 Administrator Access

- The Administrator role has full management rights (AAB §15).
- Access via the Web Administration Portal.
- Requires authentication (JWT) with MFA recommended.

### 2.2 Admin Dashboard

- Overview of system health.
- Quick access to Users, Roles, Permissions, Settings, Backup, Audit.

---

## 3. User Management

### 3.1 Managing Users

| Task | Procedure Summary |
|---|---|
| Create user | Provide username/email; link to employee; set role; auto-create default permissions |
| Edit user | Update profile, role, status |
| Disable user | Soft-disable (`is_active=0`) + revoke linked permissions (not physical delete) |
| Track login | View `last_login` per user |

### 3.2 Security Rules

- Passwords hashed (bcrypt/argon2) — never plaintext.
- Least privilege enforced.
- Users linked to employee records.

---

## 4. Roles & Permissions

### 4.1 Role Management

- Define roles (Admin, Asset Manager, Auditor, Department Manager, Inventory Team, Maintenance, Employee).
- Role templates available (AAB §16 new features).

### 4.2 Granular Permissions (AAB §13.5)

Each module has independent permissions:

| Permission | Meaning |
|---|---|
| `CanView` | View records |
| `CanAdd` | Create records |
| `CanEdit` | Modify records |
| `CanDelete` | Delete records |
| `CanPrint` | Print/export |

### 4.3 Per-User Grants

- Permissions can be granted per user (not only per role).
- New users receive default permissions automatically.

### 4.4 Module Registry (AAB §13.13)

Assets · AssetTypes · MainLocations · SubLocations · AssetStatus · AssetModels · Employees · InventoryCycles · InventoryEntry · InventoryReview · TransferAsset · MovementHistory · ReportInventory · ReportAssets · ReportMovement · Users · Backup · SystemSettings · AuditLog · ImportData.

---

## 5. Settings Management

### 5.1 Settings (Key-Value Store)

- Settings stored as `SettingKey` / `SettingValue`.
- Examples: organization name, logo, automatic backup settings.
- Only administrators modify reference settings.

---

## 6. Backup & Restore

### 6.1 Backup Management

- Automatic scheduled backup (frequency/time/retention).
- Auto-generated backup names.
- `.bak` files + cloud storage.
- **Point-in-Time Recovery** available.

### 6.2 Restore

- Restore from selected backup.
- Restore tested monthly (mandatory).

> Follow Runbook `RB-001` for database restore.

---

## 7. Audit Log

### 7.1 Viewing Audit Log

- Filter by date, action type, user, search.
- Each record: ActionType, TableName, RecordID, UserID, ActionDate, Details, IP.
- **Immutable** (append-only); retention 7 years.

### 7.2 Audit Use

- Trace sensitive operations.
- Support investigations and compliance.

---

## 8. Inventory Administration

### 8.1 Managing Inventory Cycles

- Create cycles (snapshot of active assets).
- Assign teams.
- Monitor progress/statistics.
- Close/lock cycles.

### 8.2 Field Operations

- View device status, last sync, pending/failed/conflicts.
- Resolve or escalate conflicts.

---

## 9. Monitoring & Operations

- View system health via admin dashboards.
- Monitor alerts (via DevOps tooling).
- Coordinate incident response per Operations Manual.

---

## 10. Security Administration

| Task | Procedure |
|---|---|
| Password policy | Enforced (hashing, cost factor) |
| Session management | View/revoke sessions |
| MFA | Enable for administrators (V2+) |
| Data classification | Manage PII access |

---

## 11. Import/Export Administration

- Data import (Excel/Access) with three modes (Import Selected, Clear & Import, Update Import).
- Error tracking per record.
- Export reports (Excel/PDF/CSV/JSON).

> Per AAB §13.7 (ImportData module) — rebuild as background job.

---

## 12. Troubleshooting & Support

| Issue | Resolution |
|---|---|
| User cannot log in | Verify account active; check password; reset |
| Permission issue | Review role/per-user permissions |
| Sync stuck | Check device status; resolve conflicts |
| Backup failed | Review schedule; run manual backup |
| Audit missing entries | Confirm audit enabled for operation |

- Escalate via L2/L3 support per Operations Manual.

---

## 13. Administrator Responsibilities

| Responsibility | Description |
|---|---|
| User & access lifecycle | Create/disable users; manage permissions |
| System configuration | Settings, roles, reference data |
| Data integrity | Monitor backups, imports |
| Security | Enforce least privilege; review audit |
| Operational oversight | Monitor health; coordinate incidents |

---

## 14. References

| Reference | Location |
|---|---|
| FRS (Administration) | Requirements/Functional_Requirements_Specification.md |
| Security Architecture | Security/Security_Architecture.md |
| Operations Manual | Operations/Operations_Manual.md |
| End User Guide | User_Guides/End_User_Guide.md |

---

## 15. Document Control (Closure)

| Field | Value |
|---|---|
| **Status** | Approved Baseline |
| **Approved By** | CAB |

> **End of Administrator Guide.**
