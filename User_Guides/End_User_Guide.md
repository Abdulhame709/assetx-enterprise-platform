# END USER GUIDE
## AssetX Enterprise Platform — User Guide

> **Document ID:** `USER-GUIDE-001` | **Version:** 1.0 | **Status:** Approved Baseline
> **Reference:** AAB v6.0 (§11H, §13.3, §15) · PRD (Personas) · UI/UX Spec
> **Path:** `User_Guides/End_User_Guide.md`

---

## 0. Document Control

| Field | Value |
|---|---|
| **Document Title** | End User Guide |
| **Document Owner** | Documentation Team / Product |
| **Contributors** | UX, Product, Support |
| **Authoritative Basis** | AAB v6.0 (User journeys, features); PRD personas |
| **Approval Body** | CAB |
| **Version** | 1.0 |

---

## 1. Introduction

### 1.1 Purpose

This guide helps **end users** use the AssetX platform for their daily work: asset management (Web), field inventory (Mobile), auditing, and reporting. It is organized by user role.

### 1.2 Audience

Asset Managers, Field Agents, Auditors, Department Managers, Maintenance staff, and Employees.

---

## 2. Getting Started

### 2.1 Sign In

1. Open the AssetX Web Portal (or Mobile app).
2. Enter your username and password.
3. You are authenticated via secure login (JWT).
4. Your access is based on your role and permissions (least privilege).

### 2.2 Understanding Permissions

- Your permissions determine what you can view/add/edit/delete/print.
- If you lack a permission, the action is unavailable to you.

---

## 3. Asset Manager (Web)

### 3.1 Managing Assets

- **Create asset:** name, category, location, status, quantity, price, etc. Code is auto-generated.
- **Edit asset:** update fields; protected assets require system-admin (asset protection rules).
- **Delete asset:** soft-delete (is_active=false), never physical.
- **QR/barcode:** generate and print for each asset.

### 3.2 Viewing Asset Details

- Full lifecycle information: location, custodian, status, value, history, movements, maintenance.

### 3.3 Movement & Transfers

- Log transfers (from/to location, employee, status + reason/ref/approver).
- Disposal/retirement: deactivates the asset and sets status.
- Movement history is permanent.

---

## 4. Field Agent (Mobile) — Field Inventory

### 4.1 Preparing

1. Open the app and select an active inventory cycle.
2. Download the cycle (expected assets) to your device.
3. Go offline — the app works fully offline.

### 4.2 Counting Assets

- **Scan QR/barcode** to select an asset.
- **Quick Match:** one tap to mark as matched.
- **Bulk match by location:** match all assets of a location at once.
- **Capture photo** as proof.
- **GPS** recorded to verify presence.

### 4.3 Recording Results

- System computes the result: Matched / Deficit / Surplus / Transferred / Missing / Not Inventoried.
- **Undo:** reset a record to "Not Inventoried."
- **Auto-advance:** moves to the next record automatically.
- **Actual holder:** optionally record who physically holds the asset.

### 4.4 Synchronization

- Records save locally (offline) and queue for sync.
- When back online, tap Sync to upload.
- Check sync status (pending/failed/conflicts).
- Resolve conflicts if prompted (Take Local / Take Server / Merge).

---

## 5. Auditor (Web)

### 5.1 Reviewing Inventory

- Review discrepancies (Matched/Deficit/Surplus/Transferred/Missing/Not Inventoried).
- Filter by result, location, team, date.

### 5.2 Verification

- **Verify / Unverify** records; verify all.
- Track who verified and when.
- Add review notes.
- Approve or reject discrepancies.

---

## 6. Department Manager (Web)

- View assets for your department.
- Generate reports.
- Monitor inventory progress for your area.

---

## 7. Maintenance (Web)

- Manage maintenance orders for assets.
- Status auto-updates when maintenance starts.
- Track costs, technicians, dates, next maintenance.

---

## 8. Employee

- View only assets in your custody.
- Access your asset list via portal/mobile.

---

## 9. Reporting & Dashboards

### 9.1 Dashboards

- Real-time KPIs: asset counts, status/type distribution, total value, current cycle progress, recent movements.

### 9.2 Reports

- Apply hierarchical filters (location tree, type, status, employee, model).
- Select a parent location to include all descendants.
- Preview before print.
- Export to Excel/PDF/CSV/JSON.

---

## 10. Search

- **Smart search** across 9 fields: name, base/full code, serial, barcode, description, location, type, employee.
- Results ranked by relevance.
- Debounced (300 ms) to reduce queries.

---

## 11. Notifications

- Receive notifications (campaign assignments, sync failures, approvals).
- Channels: push (FCM), email, WhatsApp (as enabled).
- Act on critical alerts (e.g., asset not inventoried for a long time).

---

## 12. Keyboard Shortcuts (Web)

| Shortcut | Action |
|---|---|
| Ctrl+S | Save |
| F3 | New |
| F4 | Copy |
| F5 | Refresh |
| Esc | Cancel |

---

## 13. Best Practices

- Keep your device's app updated.
- Sync regularly when online to avoid large pending queues.
- Verify your work before submitting (esp. auditors).
- Report issues via the service desk.

---

## 14. Troubleshooting (User Level)

| Issue | Solution |
|---|---|
| Can't log in | Verify credentials; contact admin if locked |
| Offline not syncing | Check connection; tap Sync |
| Missing permission | Contact admin |
| Scan not working | Ensure camera permission; clean lens |
| Conflict prompt | Choose correct value or contact support |

---

## 15. Support

- Contact the service desk for assistance.
- Escalation: L1 → L2 → L3 per Operations Manual.
- Reference the incident priority (P1–P4) if urgent.

---

## 16. References

| Reference | Location |
|---|---|
| Administrator Guide | Administration/Administrator_Guide.md |
| UI/UX Spec | UI-UX/UI_UX_Specification.md |
| Mobile Spec | Mobile/Mobile_Technical_Specification.md |
| Operations Manual | Operations/Operations_Manual.md |

---

## 17. Document Control (Closure)

| Field | Value |
|---|---|
| **Status** | Approved Baseline |
| **Approved By** | CAB |

> **End of End User Guide.**
