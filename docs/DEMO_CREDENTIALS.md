# Demo Credentials — AssetX RC1

> **Single source of truth** for demo/preview access (RC1 stabilization — D4).
> **Tenant:** `demo` ("AssetX Demo") · **Mode:** real backend (not mock).

---

## Primary demo account (real mode — the running preview)

| Field | Value |
|---|---|
| **Username** | `admin` |
| **Password** | `AdminPass123` |
| Email | `admin@assetx.io` |
| Role | `Administrator` (full permissions — 44 permission keys) |
| Tenant | `demo` — "AssetX Demo" (`tenant_code: demo`) |

> Created automatically at every backend boot by `backend/src/bootstrap/db-init.ts`
> (bcrypt cost 12). Login: `POST /auth/login` → JWT pair; permissions and
> `permission_version` ride in the access token.

## Demo dataset (QA/product preview)

The demo tenant is seeded with a **reproducible demo dataset** when the backend
boots with:

```bash
ASSETX_SEED_DEMO=1 npm start        # backend (port 3001)
```

Dataset contents (idempotent — never duplicates on re-boot):

- **Locations:** HQ (Floor 1 → Room 101/102, Floor 2 → Room 201) + Warehouse (Rack A/B) — 9 hierarchical nodes
- **Master data:** 4 categories (IT, Furniture, Vehicles, Machinery) · 6 asset models · 3 statuses (Good/Maintenance/Retired) · 6 employees
- **Assets:** 16 assets with codes `2026-0001@…`, barcodes `BC-DEMO-*`, serials `SN-DEMO-*`, prices, custodians
- **Movements:** 1 pending transfer (approval workflow demo) + 1 approved assignment
- **Inventory:** cycle **2026** `in_progress` with snapshot records — 14 counted (1 with variance), 2 missing
- **Notifications:** 2 unread + 1 read (demo inbox)
- **Audit events:** 7 sample events (asset/movement/inventory/auth)

## Mock-mode accounts (NOT valid in real mode)

When `NEXT_PUBLIC_AUTH_MODE=mock` (development fallback only), the web app uses
`web/src/lib/auth/mock-session.ts`:

| Username | Password | Role |
|---|---|---|
| `admin` | `AdminPass123` | Administrator |
| `manager` | `Manager123` | Asset Manager |
| `inventory` | `Inventory123` | Inventory Team |
| `auditor` | `Auditor123` | Auditor |
| `executive` | `Executive123` | Executive |

> ⚠️ These accounts **do not exist** in the real backend. The running RC1
> preview uses real mode — only `admin / AdminPass123` works there.

---

*Last updated: 2026-08-07 (RC1 stabilization).*
