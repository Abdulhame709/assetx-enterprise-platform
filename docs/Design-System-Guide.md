# AssetX Design System Guide

How to build screens that look and behave like the rest of the app. Everything below lives in
`web/src/components/ui/` unless stated otherwise.

## Rules that apply everywhere

- **Both languages.** Every visible string goes through `t('...')` in `web/src/lib/i18n.tsx`. The `en` and `ar` key sets must stay identical (a unit test checks this).
- **RTL-safe layout.** Use logical Tailwind classes (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`, `border-s-*`) — never `ml-*`, `pr-*`, `text-left`.
- **Mixed-direction text.** Wrap user data (names, codes) in `<bdi dir="auto">`. Codes, serials and numbers use Latin digits and `dir="ltr"`.
- **Colours come from tokens**, not hex values: `ink`, `ink-muted`, `ink-faint`, `line`, `surface`, `surface-muted`, `surface-raised`, `brand`, `brand-soft`, `danger`, `warning`, `success`, `info`.

## Forms

### `Field`
Wraps one control with a label, an optional hint and an optional error.

```tsx
<Field label={t('assets.name')} hint={t('assets.nameHint')} error={errors.name}>
  <Input value={name} onChange={(e) => setName(e.target.value)} required />
</Field>
```

When `Field` has a **single control child** it wires up accessibility automatically: the label's `htmlFor`, `aria-describedby` (hint/error) and `aria-invalid`. The error is rendered with `role="alert"` so screen readers announce it. If you pass several children, give each control its own `id`/label.

Controls: `Input`, `Textarea`, `Select` (all from `form.tsx`). Do not use raw `<input>`/`<select>` — they miss the shared focus ring and sizing.

### `Checkbox` vs `Switch`

| Use | When |
|---|---|
| `Checkbox` | A choice that is **saved with the form** (permissions, filters, multi-select). `variant="card"` draws a clickable bordered tile. Without `label`, add an `aria-label`. |
| `Switch` | A setting that **applies immediately** when toggled (`role="switch"`). Takes `checked`, `onChange(next)`, `label`, optional `description`. |

```tsx
<Checkbox label={t('roles.canExport')} checked={v} onChange={(e) => setV(e.target.checked)} />
<Switch label={t('settings.emailAlerts')} checked={on} onChange={setOn} />
```

## Messages and feedback

### `Alert` — inline, stays on screen
`tone`: `info | success | warning | danger`. Optional `title`, `action`, `onDismiss`.

- `danger` and `warning` use `role="alert"` and play the **attention pulse** once (twice-ring) so a new problem catches the eye without blocking the user. `info`/`success` use `role="status"` (polite, no animation).
- Put the error **next to what failed** (above the submit button for a form, at the top of the page for a failed load).
- Turn raw API errors into readable text with `humanError(err, fallback, locale)` from `@/lib/api/errors`; it maps the backend's stable error codes (e.g. `IMPORT_TOO_MANY_ROWS`) to translated messages.

### `Toast`
Short confirmation after an action ("Saved"). It disappears by itself; do not use it for errors the user must act on — use `Alert`.

### `useConfirm` (in `ConfirmDialog.tsx`)
Call `confirm = useConfirm()` (the app already provides `ConfirmProvider`) before anything destructive or hard to undo (delete, bulk change, template removal). State what will happen and name the item.

## Motion cues

Both are defined in `web/src/app/globals.css` and are **disabled for users who prefer reduced motion**.

| Class | Effect | Use for |
|---|---|---|
| `animate-attention` | Soft pulsing ring, 2 cycles. Colour follows `--ax-attention` (defaults to danger; `Alert` sets it to warning for warnings). | A new error or warning appearing. |
| `animate-flash` | Background fades from a brand tint to transparent over ~1.6 s. | A row/card that was just created or changed, so the user can find it. |

Apply `animate-flash` conditionally (e.g. to the row whose id equals `lastSavedId`) and remove it on the next navigation; do not leave it on permanently.

## Menus

`useMenu()` gives dropdowns the same keyboard behaviour everywhere (row actions, user menu, column picker):

- closes on outside click and `Escape` (focus returns to the trigger),
- `ArrowDown`/`ArrowUp` on the trigger opens it and focuses the first/last item,
- arrows, `Home`, `End` move between items; `Tab` closes.

```tsx
const { open, setOpen, rootRef, triggerRef, menuRef, onTriggerKeyDown, onMenuKeyDown } = useMenu();
// <div ref={rootRef}> <button ref={triggerRef} onKeyDown={onTriggerKeyDown} aria-haspopup="menu" aria-expanded={open}/>
// {open && <div ref={menuRef} role="menu" onKeyDown={onMenuKeyDown}> <button role="menuitem">…</button> </div>}
```

Menu items must carry `role="menuitem"` (or `data-menu-focusable`) to be reachable by the arrow keys.

## Structure and landmarks

- Every page has exactly one `<h1>` (via `PageHeader`); `CardHeader` titles render as `h2`.
- The authenticated shell provides `<main id="main-content">` and a skip link. The login layout provides its own `<main id="main-content">`; pages must not add another `<main>`.
- `Tabs` implement the tablist pattern (roving tabindex, arrow keys that follow reading direction in RTL).

## Colour contrast (WCAG AA)

The light theme tokens were tuned so normal text meets 4.5:1 on the surfaces it is used on:

| Token | Light value | Notes |
|---|---|---|
| `--ax-primary` | `150 94 32` (#965E20) | AA as text on light surfaces and as a background under white text |
| `--ax-primary-hover` | `124 77 24` (#7C4D18) | |
| `--ax-ink-muted` | `92 94 84` (#5C5E54) | secondary text |
| `--ax-ink-faint` | `110 110 100` (#6E6E64) | hints, placeholders — the lightest text allowed |

Do not use a lighter grey for text that carries meaning. When adding a theme, check the four tokens above against its `surface` colours.

## Checking your work

From `web/`:

```bash
npx tsc --noEmit
npx vitest run
npx eslint
```

For accessibility, run axe-core against the page in both languages and fix every serious/critical violation before merging. Typical findings are an unlabeled control (use `Field`), low contrast (use tokens) or a missing landmark.
