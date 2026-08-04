# AssetX — Web Application (Phase P1: Application Shell + Design System)

Frontend foundation for the AssetX Enterprise Asset Management Platform.
**P1 scope only** — Application Shell + Enterprise Design System + reusable
components + frontend architecture. No business modules implemented yet.

## Stack

- **Next.js 14** (App Router) + React 18 + TypeScript
- **Tailwind CSS** (design-token driven via CSS variables)
- **lucide-react** icons
- No heavy state library — `SessionProvider` (React Context) for auth/tenant/permissions

## Structure

```
src/
  app/                    routes (feature-based)
    (auth)/login          authentication layout + login screen
    (dashboard)/          AppShell layout + module placeholder routes
  components/
    auth/                 PermissionGate, permission guard
    shell/                AppShell, Sidebar, Topbar, UserMenu, TenantBadge, PlaceholderPage
    ui/                   Button, Card, Badge, form, DataTable, FilterBar, Modal,
                          Timeline, KpiCard, ActionMenu, states, PageHeader
  lib/
    api/                  API client layer (client.ts, endpoints.ts)
    auth/                 session-context, permissions, mock-session, auth-service
    navigation.ts         permission-driven nav config
    cn.ts                 class helper
  types/                  auth.ts, …
```

## Design System

- **Tokens:** colors (brand, surface, ink, line, semantic status), typography
  (Latin + Arabic), spacing 4/8/12/16/24, radii, shadows — all in `globals.css`.
- **Components:** reusable enterprise components (tables, KPI cards, filters,
  forms, badges, timeline, status indicators, action menus, modal, empty/loading/error states).

## Environment

- `NEXT_PUBLIC_API_URL` — backend base URL (default `/api`).
- `NEXT_PUBLIC_AUTH_MODE` — `mock` (P1 demo) or `real` (backend AuthService).

## Scripts

- `npm run dev` — dev server (port 3000)
- `npm run build` — production build
- `npm run start` — start production build

## Demo accounts (mock mode)

`admin/AdminPass123`, `manager/Manager123`, `inventory/Inventory123`,
`auditor/Auditor123`, `executive/Executive123`.

## Roadmap

P2 Asset Experience → P3 Inventory Experience → P4 Maintenance Experience →
P5 Reporting & Analytics Experience. See repo Product Blueprint.
