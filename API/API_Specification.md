# API SPECIFICATION
## AssetX Enterprise Platform — Public REST API

> **Document ID:** `API-SPEC-001` | **Version:** 1.0 | **Status:** Approved Baseline
> **Reference:** AAB v6.0 (§11I API Contract, §11AA) · SAD · PEP v1.0
> **Path:** `API/API_Specification.md`

---

## 0. Document Control

| Field | Value |
|---|---|
| **Document Title** | API Specification |
| **Document Owner** | Backend Lead / Solution Architect |
| **Contributors** | Web & Mobile Teams, QA, Integration |
| **Authoritative Basis** | AAB v6.0 (API Contract); approved stack (NestJS/OpenAPI) |
| **Review Body** | TRB |
| **Approval Body** | CAB |
| **Version** | 1.0 |

> **API-First principle:** every function has an API before its UI.

---

## 1. Introduction

### 1.1 Purpose

Defines the **public REST API** of AssetX: conventions, authentication, authorization, endpoints, payloads, errors, pagination, and rate limiting. It is the contract surface consumed by the Web Portal, Mobile App, and future integrations.

### 1.2 Scope

The REST API layer implemented on NestJS, documented via OpenAPI/Swagger, with JWT authentication and RBAC authorization.

---

## 2. API Conventions

### 2.1 Base URL & Versioning

- Base URL: `https://api.assetx.example.com/api/v1`
- Versioning: URL path segment (`/v1`).
- Content-Type: `application/json`.

### 2.2 Naming Conventions (AAB §11AA)

| Element | Rule | Example |
|---|---|---|
| Endpoints | `kebab-case`, plural | `/api/inventory-cycles` |
| JSON fields | `camelCase` | `assetCode`, `createdAt` |
| HTTP verbs | REST semantics | GET/POST/PATCH/DELETE |

### 2.3 Pagination (Cursor-based)

- Query params: `cursor`, `limit`.
- Response envelope includes `nextCursor`, `hasMore`.

### 2.4 Response Envelope

Standard response envelope:

```json
{
  "data": {},
  "meta": { "nextCursor": "...", "hasMore": false },
  "error": null
}
```

---

## 3. Authentication & Authorization

### 3.1 Authentication

- **Supabase Auth** / JWT.
- Access token: JWT (15 min lifetime).
- Refresh token: 7 days.
- Auth header: `Authorization: Bearer <access_token>`.

### 3.2 Authorization

- **RBAC** roles + granular per-module permissions.
- Enforcement via NestJS guards/decorators.
- Least privilege (BR-SEC-005).

### 3.3 Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/login` | POST | Authenticate; return JWT pair |
| `/api/auth/refresh` | POST | Refresh access token |
| `/api/auth/logout` | POST | Revoke session |
| `/api/auth/mfa` | POST | MFA (OTP) — V2 |

---

## 4. Asset API

| Endpoint | Method | Description |
|---|---|---|
| `/api/assets` | POST | Create asset (auto code) |
| `/api/assets` | GET | List + filter + pagination (`?q=&status=&location=&page=`) |
| `/api/assets/{id}` | GET | Get asset detail |
| `/api/assets/{id}` | PATCH | Update asset |
| `/api/assets/{id}` | DELETE | Soft-delete asset |
| `/api/assets/{id}/qr` | GET | Get QR/barcode representation |
| `/api/assets/bulk` | PATCH | Bulk edit |
| `/api/assets/similar` | GET | Similar-name search |

**Request — Create Asset (`POST /api/assets`)**

```json
{
  "name": "Laser Printer",
  "categoryId": "uuid",
  "modelId": "uuid",
  "locationId": "uuid",
  "quantity": 1,
  "statusId": "uuid",
  "employeeId": "uuid",
  "purchasePrice": 1200.00,
  "purchaseDate": "2026-01-15"
}
```

**Response — Create Asset**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Laser Printer",
    "baseAssetCode": "2026-0001",
    "fullAssetCode": "2026-0001@main-office",
    "categoryId": "uuid"
  }
}
```

---

## 5. Location API

| Endpoint | Method | Description |
|---|---|---|
| `/api/locations` | POST | Create location |
| `/api/locations` | GET | List (hierarchical) |
| `/api/locations/{id}` | GET | Detail + descendants |
| `/api/locations/{id}` | PATCH | Update |
| `/api/locations/{id}` | DELETE | Delete (protected) |
| `/api/locations/{id}/descendants` | GET | Recursive descendants |

---

## 6. Employee API

| Endpoint | Method | Description |
|---|---|---|
| `/api/employees` | POST | Create employee |
| `/api/employees` | GET | List + filter |
| `/api/employees/{id}` | GET | Detail |
| `/api/employees/{id}` | PATCH | Update |
| `/api/employees/{id}` | DELETE | Soft-delete |

---

## 7. Inventory Cycle API

| Endpoint | Method | Description |
|---|---|---|
| `/api/inventory/cycles` | POST | Create cycle (snapshot) |
| `/api/inventory/cycles` | GET | List cycles |
| `/api/inventory/cycles/{id}` | GET | Cycle detail + statistics |
| `/api/inventory/cycles/{id}` | PATCH | Update cycle (status) |
| `/api/inventory/cycles/{id}/close` | POST | Close cycle (lock) |
| `/api/inventory/cycles/{id}/team` | POST | Assign team |
| `/api/inventory/records/{id}` | POST | Record inventory result |
| `/api/inventory/records/{id}/verify` | POST | Verify record |
| `/api/inventory/records/{id}/verify` | DELETE | Unverify record |
| `/api/inventory/summary` | GET | Cycle summary by result/location |

**Request — Create Cycle**

```json
{
  "year": 2026,
  "teamMemberIds": ["uuid1", "uuid2"]
}
```

**Response — Cycle Statistics**

```json
{
  "data": {
    "id": "uuid",
    "status": "inProgress",
    "total": 1000,
    "inventoried": 600,
    "matched": 550,
    "deficit": 20,
    "surplus": 10,
    "transferred": 5,
    "missing": 5,
    "notInventoried": 400,
    "completion": 60.0
  }
}
```

---

## 8. Transfer / Movement API

| Endpoint | Method | Description |
|---|---|---|
| `/api/movements` | POST | Log transfer |
| `/api/movements` | GET | List + filter |
| `/api/movements/{id}` | GET | Movement detail |
| `/api/assets/{id}/movements` | GET | Asset movement history |
| `/api/disposals` | POST | Disposal |
| `/api/retirements` | POST | Retirement |

---

## 9. Attachments API

| Endpoint | Method | Description |
|---|---|---|
| `/api/attachments` | POST | Upload attachment (multipart) |
| `/api/attachments/{id}` | GET | Get/download |
| `/api/attachments/{id}` | DELETE | Delete |
| `/api/assets/{id}/attachments` | GET | List asset attachments |

---

## 10. Reporting API

| Endpoint | Method | Description |
|---|---|---|
| `/api/reports/inventory-summary` | GET | Inventory summary by location |
| `/api/reports/assets` | GET | Asset report with filters |
| `/api/reports/movements` | GET | Movement report |
| `/api/reports/export` | GET | Export (excel/pdf/csv/json) |

---

## 11. Dashboard & Analytics API

| Endpoint | Method | Description |
|---|---|---|
| `/api/dashboard/kpis` | GET | KPI summary |
| `/api/dashboard/asset-distribution` | GET | Distribution by status/type |
| `/api/dashboard/total-value` | GET | Total asset value |
| `/api/dashboard/current-cycle` | GET | Current cycle status |

---

## 12. Notifications API

| Endpoint | Method | Description |
|---|---|---|
| `/api/notifications` | GET | List user notifications |
| `/api/notifications/{id}/read` | POST | Mark read |
| `/api/notifications/templates` | GET | Templates |
| `/api/notifications/templates` | POST | Create template |

---

## 13. Administration API

| Endpoint | Method | Description |
|---|---|---|
| `/api/admin/users` | CRUD | User management |
| `/api/admin/roles` | CRUD | Roles |
| `/api/admin/permissions` | CRUD | Permissions |
| `/api/admin/user-permissions` | CRUD | Per-user granular grants |
| `/api/admin/settings` | GET/PUT | Key-value settings |
| `/api/admin/backup` | POST | Create backup |
| `/api/admin/backup/restore` | POST | Restore |

---

## 14. Audit API

| Endpoint | Method | Description |
|---|---|---|
| `/api/audit` | GET | Query audit log (filter by date/type/user) |

---

## 15. Sync API (Mobile — Offline)

| Endpoint | Method | Description |
|---|---|---|
| `/api/sync/upload` | POST | Upload local changes (batch) |
| `/api/sync/download` | GET | Download incremental changes |
| `/api/sync/ack` | POST | Acknowledge applied changes |
| `/api/sync/devices` | POST | Register device |
| `/api/sync/devices/{id}/revoke` | POST | Revoke device + wipe queue |

**Sync Upload — Request**

```json
{
  "deviceId": "uuid",
  "records": [
    { "localId": "uuid", "entity": "inventoryRecord", "data": {}, "version": 3 }
  ]
}
```

**Sync Download — Response**

```json
{
  "data": {
    "changes": [ { "entity": "assets", "id": "uuid", "data": {}, "version": 4 } ],
    "cursor": "...",
    "hasMore": false
  }
}
```

---

## 16. Error Handling

### 16.1 Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid input |
| `UNAUTHORIZED` | 401 | Missing/invalid token |
| `FORBIDDEN` | 403 | Insufficient permission |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Conflict (e.g., duplicate code, locked cycle) |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

### 16.2 Error Response Format

```json
{
  "data": null,
  "error": {
    "code": "CONFLICT",
    "message": "Asset code already exists",
    "details": {}
  }
}
```

---

## 17. Rate Limiting

- Applies per tenant/user.
- Default limits defined per endpoint category.
- Returns `429` with retry-after when exceeded.
- Configurable per integration.

---

## 18. OpenAPI / Swagger

- All endpoints documented via OpenAPI 3.0 (Swagger UI available).
- DTOs defined in TypeScript (NestJS) with validation (class-validator / Zod).
- OpenAPI spec is the contract source for Web, Mobile, and integrations.

---

## 19. API Security

| Control | Implementation |
|---|---|
| Authentication | JWT (Supabase) |
| Authorization | RBAC guards + per-module permissions |
| Tenant isolation | RLS via session tenant |
| Input validation | Zod / class-validator |
| Rate limiting | Per tenant/user |
| TLS | TLS 1.3 |
| Audit | Sensitive mutations audited |

---

## 20. Versioning & Evolution

- Backward-compatible changes: additive only within a version.
- Breaking changes: new major version (`/v2`).
- Deprecation: announced with timeline.

---

## 21. Traceability

| API Group | FRS Module | Business Rule |
|---|---|---|
| Assets | FR-ASSET | BR-ASSET-* |
| Inventory | FR-INV/FR-FLD | BR-INV-* |
| Movements | FR-MOV | BR-MOV-* |
| Sync | FR-SYN | ADR-003 |

---

## 22. References

| Reference | Location |
|---|---|
| SAD | Architecture/Software_Architecture_Document.md |
| DDS | Database/Database_Design_Specification.md |
| Mobile Spec | Mobile/Mobile_Technical_Specification.md |
| Security | Security/Security_Architecture.md |

---

## 23. Document Control (Closure)

| Field | Value |
|---|---|
| **Status** | Approved Baseline |
| **Approved By** | CAB |

> **End of API Specification.**
