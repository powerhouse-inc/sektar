# Sektar prototype — sync with the 2026-10-18 design system

The prototype vendored `sektar-design-elements/design-system` on 2026-10-17
around 16:00 (`editors/sektar/design/`). The design system kept moving for the
rest of that day; this is what changed, what it means for the app, and the
order to take it in.

## 1. What changed in the design system

Measured by diffing the vendored copy against the source selector by selector
(whitespace-normalised). The icon sprite is byte-identical; everything else
moved.

### Foundations

| Area | Before (vendored) | Now | Impact on the app |
|---|---|---|---|
| Dark mode selector | `.dark` on `<html>` (our patch of `tokens.css`) | `:root[data-theme="dark"]`, `.sk-theme-dark` / `.sk-theme-light` islands, `prefers-color-scheme` fallback unless `data-theme="light"` | Our patched tokens file can no longer be refreshed by copying. Bridge Connect's theme to `data-theme` in the shell instead and vendor `tokens.css` unmodified. |
| Fraunces | Google Fonts | Self-hosted variable TTF (`assets/fonts/`, `css/fonts.css`), because the Google build pins the WONK axis on; every `font-variation-settings` now carries `"WONK" 0` | Headings and numerals currently render the wonky alternates. Switch to the self-hosted file. |
| `base.css` | Not vendored (headings scoped by hand in `app.css`) | Reset + document defaults + type rhythm, all with `WONK 0` | Keep it out of Connect's global scope, but regenerate our scoped typography block from it. |
| Borders | `--sk-border: var(--sk-stone)`, `--sk-border-subtle: #E5EAE4` | `#CBD3CB` / `#DBE1DA` (a touch stronger) | Free once tokens are refreshed; re-check dark captures. |
| New tokens | — | `--sk-text-accent`, `--sk-mark-1…4`, `--sk-wordmark`, `--sk-tagline-color`, `--sk-banner-art-url` | Add to the Tailwind `@theme inline` bridge. |
| Asset URLs in tokens | rewritten to `./shapes/…` | `../assets/shapes/…` | The sync script must rewrite paths. |
| Card padding | `padding: var(--sk-space-6)` | `--_pad` custom property (`--compact` sets it) | None, but use `--_pad` instead of inline padding overrides. |
| Tabs | block, our `app.css` added nowrap/scroll | `inline-flex`, `gap`, `white-space: nowrap`, `flex: none` built in | Drop our override. |

### New components (462 selectors added; the ones that matter here)

- **Live brand lockup** `.sk-lockup` (`assets/marks.svg` symbols + a real-text
  tagline, `--product` variant for app chrome). Static tagline lockups were
  removed from `assets/logos/`; we still vendor and use
  `sektar-logo-primary-tagline-*` for the splash.
- **Page header** `.sk-page-header` (title, Fraunces light lead, actions,
  optional art that hides under 900px). Replaces our `PageHeader` kit markup.
- **Detail header**, **meta strip** `.sk-meta`, **key–value** `.sk-kv`.
- **Filter pills with counts** `.sk-pills`, **tab counts** `.sk-tab__count`.
- **Rich list rows** `.sk-list-item--rich` (`__sub`, `__tags`, `__aside`,
  selection state).
- **Activity feed** `.sk-feed`, **stepper** `.sk-steps`.
- **Files / attachment chips / file-type tiles**.
- **Progress rows**, **compact ring** `.sk-ring--sm`, **stacked bars with
  axis** `.sk-bars--stacked`, `.sk-bars-axis`.
- **Avatar forms**: `--brand`, `--group`, `--ring`, photo avatars.
- **Promo card with banner** `.sk-card--promo` + `.sk-card__banner` (the
  "Upgrade to Pro" sidebar card, four-column growth art).
- **Button** `--contrast`; hero card now `border: 0`.
- **Responsive shell**: `.sk-shell--mobile` + `.sk-drawer` (sidebar becomes a
  drawer behind the top bar's menu button), `.sk-topbar__menu / __title /
  __search-btn`, `.sk-shell--rail` (collapsed sidebar rail). Narrow-content
  rules live in `@container dash (max-width: 640px)` on `.sk-shell__main`:
  one-column grids, wrapped card headers, tables stacked into two-line rows.
- **Workspace** `.sk-workspace--panes` with collapsible `.sk-pane`s, a
  `.sk-subbar`, the **responsive selector** (tab row that becomes a compact
  trigger + menu when it does not fit; list variant), and the stacked
  push-navigation under 640px.
- **Product switch**, **preview panel**, **timer**, **slides** (20 templates):
  not needed by this app.

### Behaviour script `js/sektar.js` (new)

Theme (`data-theme` + `localStorage["sk-theme"]`), sprite injection, pane
collapse, selector fit/compact, tabs, stack drill/back, drawer, product
switch, tagline. We will not load it: Connect owns the theme, and everything
else is a few lines of React state. The port list is in §3.

### Assets

- `assets/marks.svg` (symbol + wordmark `<symbol>`s), `assets/favicon.svg`.
- `logos/`: horizontal, symbol and wordmark in light/dark/black/white; the
  light symbol's third leaf recoloured to Forest 600. Tagline lockups gone.
- `app-icons/`: a new mint set beside forest/neutral/sage.
- `shapes/`: three compositions (`rise`, `quarter`, `circles`), the
  four-column growth banner, stucco variants (60 KB–1.3 MB, hero/print only).
- `photos/`: downscaled to 1400 px.

### Reference patterns worth copying

The composed **Dashboard** (desktop + phone): product lockup in the sidebar
brand (`--sk-lockup-h: 34px`, tagline "Finance Operations"), promo banner
card in the sidebar footer, top bar with menu button + page title on phones,
drawer navigation. The **Workspace** (list pane + detail pane + sub-bar) is
the pattern for list-and-detail screens, which is what our five boards are.

## 2. Where the app diverges today

- Dark mode via a patched `tokens.css` (`.dark`), so the copy cannot be
  refreshed mechanically.
- Google-hosted Fraunces (wonky alternates on).
- Our own mobile layout: a fixed bottom tab bar and ad-hoc top-bar rules in
  `app.css`; the design system now specifies a drawer and a title bar.
- `PageHeader`, `Dl`, hero card, nav items with two-line hints, list rows,
  tabs and segmented controls are our own markup where the design system now
  has a component.
- Splash and loader images are generated from the removed tagline lockup.
- The vendoring was a one-off copy with hand edits; there is no sync script.

## 3. Plan

Each phase ends with the QC capture set (`qa/`), light and dark, desktop and
phone, and `pnpm tsc && pnpm lint`.

### Phase 0 — make the vendoring repeatable (½ day)

1. Add `scripts/sync-design-system.mjs`: copies `css/{tokens,base,components,
   utilities,fonts}.css`, `assets/{icons,marks,favicon}.svg`, `assets/fonts/`,
   the logos/shapes/photos the app references, into `editors/sektar/design/`;
   rewrites `../assets/` URLs to local paths; regenerates `icons.ts` and a new
   `marks.ts` string module (tsdown cannot load `?raw`); writes a
   `SNAPSHOT.md` with the source mtime list. No hand edits downstream of it.
2. Remove the theme patch. In the shell, mirror Connect's theme onto the root:
   `useTheme()` → `data-theme="light" | "dark"` or no attribute for system.
   Connect keeps writing `.dark`; the design system reads `data-theme`; both
   agree. Keep `.sk-theme-light/dark` islands available for previews.
3. Run the script, then fix whatever the diff breaks (expected: nothing
   structural, see §1 table).

### Phase 1 — foundations (½ day)

1. Fonts: ship the Fraunces TTFs with the package, import `fonts.css`, drop
   the Google Fraunces link (keep Inter). Verify `WONK 0` in headings, stat
   values and the page-header lead.
2. Regenerate the scoped typography block in `app.css` from `base.css`
   (headings, `.sk-lead`, `.sk-eyebrow`, `kbd`, `::selection`, focus ring),
   still under `.sk-page` / `.sk-app` so Connect's own chrome is untouched.
3. Tailwind bridge: add the new tokens; add `font-sk-display` variation
   settings as a utility.
4. Delete `app.css` rules the design system now owns: tab/segmented nowrap,
   search pill width, top-bar actions `flex: none`, card compact padding.

### Phase 2 — shell (1 day)

1. Brand: replace the horizontal logo `<img>`s with the live lockup
   (`.sk-lockup--product`, tagline "Finance Operations", symbols from
   `marks.ts`). Keep the theme-swap images only for the splash.
2. Sidebar: nav items back to the design system's single-line form (drop the
   two-line hint, or keep it behind a `--roomy` modifier in `app.css` if we
   want it); footer = user menu (sign-in / chip, as agreed) above an optional
   promo banner card ("Connect a bank account" instead of "Upgrade to Pro").
3. Mobile: adopt `.sk-shell--mobile` + `.sk-drawer`. A `useMediaQuery("(max-width: 960px)")`
   hook toggles the shell class; the top bar gains the menu button and the
   page title (`.sk-topbar__title`, from the route's `staticData`), and the
   search field collapses to `.sk-topbar__search-btn` under 640px (opens the
   search as a sheet). Delete our bottom tab bar, the fixed search results
   rule and the phone top-bar overrides. Escape and scrim close the drawer; a
   nav click closes it.
4. Sticky rules stay (Connect scrolls its root element, not the window);
   re-verify with the drawer, which is `position: absolute` inside `.sk-shell`.

### Phase 3 — pages and kit (2 days)

Kit first, then the pages that use it; keep component names, change markup.

1. `PageHeader` → `.sk-page-header` with `__lead` (Fraunces light) and
   `__actions`; optional `art` prop (composition SVG, theme-swapped) used on
   the dashboard greeting and the Contacts board like the reference.
2. `Dl` → `.sk-kv`; add `MetaStrip` (`.sk-meta`) and `DetailHeader` for the
   document editors and side panels (name, sub line with bold amount, tags,
   actions, `.sk-more` overflow button).
3. `ListItem` → rich rows (`--rich`, `__sub`, `__tags`, `__aside`, selected
   state) on Invoices, Expenses, Contacts; keep the plain row for the
   dashboard lists.
4. `Tabs`/`Segmented` on the boards → `Pills` with counts for status filters
   and the **responsive selector** for the direction/kind switch (ports
   `selector.fit`: a ResizeObserver that flips `is-compact` when the tile row
   overflows, plus a menu).
5. Charts: cash flow → `.sk-bars--stacked` + `.sk-bars-axis`; books readiness
   → progress rows + `.sk-ring--sm`; keep `Donut`/`Legend`.
6. Dashboard hero → the design system's `.sk-card--hero` (ours is a custom
   `.sk-hero`); quick actions unchanged.
7. Expense claim status → `Stepper`; invoice and claim history (operations)
   → `Feed`; receipts → attachment chips / file-type tiles (placeholder until
   attachments exist in the models).
8. Avatars: contact rows get photo/initials, the drive and user chip get
   `--brand`/`--ring` where it reads better.
9. Tables: no code change, but verify the narrow-container stacked rows on the
   Transactions board and the editors (the rules assume date · description ·
   category · amount column order; reorder our columns to match or scope the
   rule off).

### Phase 4 — optional, if we want the full reference (1–2 days)

- Boards as a **workspace**: list pane + detail pane + sub-bar instead of the
  overlay `SidePanel`, with the stacked push navigation on phones. This is the
  biggest UX change and the one that most resembles the reference; do it for
  Invoices first and decide.
- Collapsible sidebar rail (`.sk-shell--rail`) for the desktop app window.
- Product switch in the sidebar brand (Sektar line: Finance Operations,
  Productivity Center, Business Travel) as a static menu.

### Phase 5 — assets and identity (½ day)

1. Move the icon pipeline from the scratchpad into `scripts/build-icons.mjs`
   (sharp): app icon from `app-icons/forest-*`, favicon from `favicon.svg`,
   splash composed from the horizontal logo + a rendered tagline (the static
   tagline lockup no longer exists), home background from a composition shape
   or a downscaled photo, drive/explorer icons from the sprite. Re-run and
   update `powerhouse.config.json` paths if names change.
2. Desktop: the same icon set feeds `hosts/desktop/app.json`; rebuild.

### Phase 6 — QC and docs (½ day)

- Re-run the capture library; add phone captures of the drawer open, the
  compact selector, a stacked table and the sign-in in the drawer.
- Side-by-side against the reference dashboard (desktop and phone) and note
  remaining deltas in `qa/index.html`.
- README: vendoring = run the script; theme bridge; which design-system
  patterns the app uses and which it leaves out (slides, timer, preview).

## 4. Order and estimate

Phases 0–2 first (about two days): they remove the hand-patched copy, fix the
font, and bring the shell to the reference. Phase 3 follows (two days) and is
where the visible polish lands. Phase 4 is a product decision; Phase 5 and 6
close it out. Total without Phase 4: roughly five working days.

## 5. Risks and notes

- Container queries: `.sk-shell__main` is the `dash` container. Everything we
  render inside Connect's shell stays within it, but Connect's own routes
  (drive explorer, settings) render in the same main area and will pick up the
  narrow-table rules; scope `.sk-page` on our pages only if that bites.
- `base.css` resets `button` and `img` globally; we keep it out and rely on
  `.sk-btn` etc. carrying their own resets, which they do today.
- Stronger border tokens change every card edge; check dark mode contrast
  against Connect's toolbar.
- The design system's phone top bar hides the user chip's text and chevron
  under 640px; our sign-in button in the top-bar copy should become an icon
  button there.
- Tagline for this product: the README names "Finance Operations" as a
  product in the line, which is what Sektar's books app is; confirm the name.
- Don't vendor the stucco shapes or the photos wholesale (sizes); copy only
  what a page references.

## Status (2026-10-18, evening)

Done: Phases 0, 1 (without the self-hosted font, by decision: Fraunces stays
on Google Fonts), 2, 3, 5 and 6. Phase 4 (workspace panes, rail, product
switch) was left out as planned. The sync script and the icon script live in
`scripts/`; the vendored copy is unmodified and `SNAPSHOT.md` names the source
files. QC captures: `qa/screens/{desktop,phone}/*-synced.png`, `*-drawer-open`,
`*-search-sheet`, `*-invoice-panel-synced`, `*-expense-panel-synced`.
