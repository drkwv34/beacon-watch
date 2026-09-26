# Frontend conventions (apps/web)

The UI is a stub today; these rules bind the dashboard and status pages when they land (Day 6).
Goal: calm, legible, operational. It should read like a status console, not a marketing site.

## Structure

- Next.js **App Router**. Routes: `/` (landing), `/login`, `/register`, `/dashboard`, `/dashboard/targets/[id]`, `/dashboard/targets/new`, `/s/[slug]` (public).
- **Server components by default**; `'use client'` only for interactive leaves (forms, "Check now").
- Data comes from the API over HTTP (`API_BASE_URL`, server-side). The web app never imports `packages/db`.
- Shared UI in `src/components/`; route-specific pieces stay in the route folder.
- No UI kit dependency for MVP. Plain CSS with tokens (`src/app/globals.css`) and component class names; CSS Modules allowed for route-local styles.

## Layout

- Single column, max content width `--content-max` (72rem), `--space-*` scale (4px base). Mobile-first; must work at **375px** (SRS §4.1).
- App shell: top header (brand, nav, account), `<main id="main">`, skip link first in the DOM.
- Dashboard list is a table on desktop and stacked cards below 640px. Target detail: status header → recent checks → incident timeline → edit form.
- Public status page: target name, big status badge, 24h uptime %, recent incidents; no navigation chrome beyond the brand.

## Tokens

- Colors, spacing, radii, and fonts are CSS custom properties defined **only** in `globals.css`. No hex values in components.
- Status palette: `--color-status-{up,down,unknown,paused}`. Light and dark via `prefers-color-scheme`.
- Numbers (latency, uptime) use tabular figures; timestamps show relative time with the absolute ISO time in a `title`/`<time dateTime>`.

## Accessibility (NFR-A11Y-001, WCAG 2.2 AA target)

- **Status is never color-only**: `StatusBadge` always renders text (`Up`, `Down`, `Unknown`, `Paused`) next to the dot.
- Every input has a visible `<label>`; errors are linked with `aria-describedby` and announced; focus moves to the first invalid field on submit.
- Visible `:focus-visible` outline on everything interactive; full keyboard path through every flow.
- Respect `prefers-reduced-motion`. Contrast ≥ 4.5:1 for text.
- Live status changes use `aria-live="polite"`; errors use `role="alert"`.

## Empty, loading, and error states (every data view must define all three)

| State | Pattern | Required copy (SRS) |
| --- | --- | --- |
| Empty (no targets) | `StatePanel` with a primary CTA | "Add your first monitor." (FR-TGT-003) |
| No checks yet | `StatePanel`, neutral | "Monitoring starting…" (FR-PUB-002) |
| All targets paused | `StatePanel`, neutral | Explicit paused message (FR-PUB-002) |
| Never succeeded | inline notice on detail/status page | "No successful checks yet." (FR-PUB-002) |
| Loading | `loading.tsx` skeleton matching final layout; no spinners longer than 300ms without text | — |
| Error | `error.tsx` → `StatePanel tone="danger"` with retry button and `request_id` | — |
| Degraded (served from DB because cache is down) | subtle banner, not an error | "Live data may be slightly delayed." |
| Not found / private status page | `not-found.tsx` | Same 404 for missing and private (no existence leak) |

## Forms

- Validate on the client for UX, but the API is authoritative; map `VALIDATION_FAILED.details.fields` to inline messages.
- Disable submit while pending and show progress text; never double-submit.
