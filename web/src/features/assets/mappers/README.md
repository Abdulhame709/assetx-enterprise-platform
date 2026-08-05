# Asset Experience — Mapping Layer

> PRE-P3.2.2 — DTO Alignment & Mapping.

## Philosophy

The frontend must never be coupled directly to the backend's HTTP contract.
All transformations between **backend DTOs** and **frontend domain models** are
centralized in this `mappers/` folder — the single source of truth.

If the backend changes a response shape (array vs `{items}`, field renames, etc.),
you edit **only this folder** — pages, components, hooks, and the API client
stay unchanged.

## Responsibilities

- **Response normalization** (`normalize.ts`): accept array / `{items}` / `{data}`
  / `{results}` / single-object responses and produce a uniform shape.
- **DTO mapping** (`index.ts`): map raw rows → `AssetSummary` / `AssetDetail` /
  `AuditEvent` / `AssetMovement` / `LifecycleTransitions` / `AssetAnalyticsSummary`.
- **Name resolution**: replace raw UUIDs (`category_id`, `location_id`,
  `employee_id`, `status_id`) with human-readable names via `NameLookup`.
- **Human-readable formatting**: `humanId()` hides UUIDs; `resolveName()` gives a
  clear placeholder (`—`) when a name can't be found.

## Boundaries (what is NOT here)

- No business logic, no filtering/aggregation rules.
- No state management, no API calls, no React hooks/components.
- No authorization / permission logic.

## Examples

### Before (raw backend)
```json
// GET /categories
[ { "id": "1708a6fe-...", "name": "IT" } ]
```

### After (via mapper)
```ts
mapCategories(raw) // → [ { value: "1708a6fe-...", label: "IT" } ]
```

### Asset summary — UUIDs resolved to names
```ts
// raw row has location_id = "1708a6fe-..."
mapAssetSummary(raw, names)
// → { ..., _locationName: "HQ", location_id: "1708a6fe-..." }
```

## Testing

Unit tests live alongside (`*.test.ts`) and are independent of the API:
- Array / wrapped / empty / malformed responses
- Name resolution + fallback values
- Field coercion (quantity string→number, is_active, price)
