# Visual / UX inspection — 2026-10-18

Method: Playwright drives the production build served by the desktop sidecar
(`http://127.0.0.1:6540`), navigating in-app after one 25 s first load, and
captures every surface and its states at 1440 px, 1100 px and 390 px in light
and dark (`qa/screens/ux/{light,dark}/<viewport>-<nn>-<name>.png`, 21 captures
per viewport). The captures were then read one by one; what follows is what
was found, what was changed, and what was left.

## Fixed in this pass

| # | Where | Finding | Change |
|---|---|---|---|
| 1 | Dashboard, Contacts (desktop + mid) | The page-header art forced a 150 px header, leaving a dead band above the stat tiles; at 1100 px the art is hidden but the band stayed. | Art is 240 px and the minimum height only applies when the design system shows the art (`@container dash (min-width: 901px)`). |
| 2 | Invoice and expense panels, phone | The design system's phone table rule (date · description · category · amount) garbled the invoice-lines and expense-items tables (cells overlapping). | `Table` has an opt-in `stack` prop; only the transaction feed and the dashboard's recent transactions stack. Other tables keep their columns and scroll in their wrap. |
| 3 | Invoice panel (560 px) | "Bill to" and "Activity" shared a two-column grid and wrapped word by word; the meta strip truncated "Due 1 Dec 202…"; the 4th meta item sat alone. | In panels, two-column grids stack, meta items go two per row and their values may wrap. |
| 4 | Invoice activity feed | "Drafted as a outgoing · receivable". | "Drafted" with the direction as the sub line. |
| 5 | Search results page | Transaction hits showed raw status codes in lowercase ("categorized", "new") and the title row could not wrap; on phones the two-column grid widened past the viewport (`1fr` lets a nowrap row set the column's min width). | Status mapped through the transaction status labels/tones; title row wraps; narrow grids use `minmax(0, 1fr)`. |
| 6 | New invoice form, phone | The line-item row squeezed the description field to two characters. | Rows in panels wrap under 640 px and the growing field keeps a 160 px minimum. |
| 7 | Business drive, phone | The folder tree sat beside the contents in a 390 px viewport; everything truncated to one or two letters. | The tree is hidden under 640 px of content width; the breadcrumbs and folder tiles remain. |
| 8 | Drawer (phone) | Tapping the current page's link in the drawer left the drawer open (it only closed on a route change). | Every sidebar link closes the drawer. |
| 9 | Transactions, mid width | The category select truncated to "Uncategorise". | 150 px minimum; the table wrap scrolls when it must. |
| 10 | Sidebar promo card | "Import a feed" rendered with link ink on the dark button. | Links styled as buttons keep the button's colour. |

## Second round — reported by Wouter after the first pass

The first pass checked the pages against the design system's components and
missed shell-level and desktop-level issues. These six were reported and are
fixed; the capture set now includes the shell states they need (`desktop-00-loading`,
`desktop-01b-dashboard-full`, `desktop-01c-rail`, `phone-short-drawer`).

| # | Finding | Change |
|---|---|---|
| 11 | The hamburger did nothing on desktop widths (hidden there). | On widths above 960px the menu button collapses the sidebar to the design system's 72px icon rail (`.sk-shell--rail`) and back; the choice is remembered per browser. Nav labels are wrapped in `.sk-nav__label` so the rail can hide them. On phones it keeps opening the drawer. |
| 12 | The drawer's footer (promo card, sign-in) was pushed below the fold when the nav grew or the window was short. | The nav is the scrolling region; brand and footer stay put. Below 870px of height the promo card is dropped (24). |
| 13 | The search field stopped at 560px on wide screens. | It takes the whole top bar between the title/menu and the actions (the design system's spacer is dropped). |
| 14 | The desktop loading screen ignored dark mode, used an ad-hoc logo + centred tagline, and floated the illustration. | The desktop shell (`@powerhousedao/desktop`, monorepo) now supports `splashDark`, `loading.dark` colours and a corner `art`/`artDark` pinned bottom-right; Sektar's `app.json` uses the live-lockup composition (symbol, wordmark, product line under the wordmark, rendered by `scripts/build-icons.mjs` in both colourways) and the growth mark flush in the corner, with Sektar's dark palette. |
| 15 | Dashboard tiles did not fill their row (gaps under shorter cards). | Every grid cell stretches its card to the row height. |
| 16 | The sidebar divider rendered white in dark mode. | `hr` / `.sk-divider` take the chrome's border colour (`--sk-border-subtle`, the same as the sidebar's edge); base.css is not vendored, so the app layer carries the rule. |
| 17 | Document editors (opened from the drive) showed the record twice: a page header with number, counterparty and status above the detail header that carries the same. | The editors render the detail view only; Connect's toolbar stays above it. |

## Third round — reading the dark and mid-width captures

| # | Finding | Change |
|---|---|---|
| 18 | The desktop sidebar grew with the page: on the dashboard (1719px tall) and the drive page the footer (promo, sign-in) sat below the fold. This is the second-round "footer pushed down" report; the drawer fix (12) did not cover the desktop sidebar. The app-layer rule that makes the sidebar sticky and viewport-high was written as `.sk-app .sk-shell > .sk-sidebar`, but `.sk-app` and `.sk-shell` are the same element, so it (and the rail hairline tweak) never matched. | Selectors are `.sk-app.sk-shell`; the sidebar is sticky and 100vh on every page, the nav scrolls inside it. |
| 19 | Record panels said everything twice: the panel header (number/name, counterparty/email, status) directly above a detail header carrying the same. | `SidePanel` takes an `eyebrow` ("Sales invoice", "Purchase bill", "Expense claim", "Contact"); alone it renders a slim bar with the close button and the detail header owns the name. The transaction panel keeps its title (it has no detail header). |
| 20 | The expense detail header was titled with the submitter's name, so with the panel title gone the claim's own title would have disappeared (and the editor never showed it). | Claim title is the heading; total, receipt count and submitter are the sub line. |
| 21 | Singular counts read "1 receipts", "1 transactions", "1 days". | A `plural()` helper in `kit/format.ts`, used for receipts, transactions, invoices/bills, claims, accounts, matches/results, days, and the "needs a category" sentence. |
| 22 | Contact rows without a city or email showed an em-dash line; the VAT field was labelled "VAT id". | Empty sub lines are dropped; "VAT ID". |
| 23 | Reported by Wouter: the signed-in account menu in the sidebar footer stayed inside the sidebar, was clipped and gave it a horizontal scrollbar. With the sidebar now a scroll container (18), the panel's shrink-to-fit width (the DID line) exceeded the sidebar. | The panel is exactly the footer's width (head lines ellipsize) and the sidebar never scrolls sideways. |
| 24 | At 1100×800 the sidebar nav scrolled behind the promo card ("Settings" half hidden); the promo only dropped out below 760px of height. | The promo is hidden below 870px of height (brand, nav, promo and sign-in need about 865px). |

## Observed and left as is

- **Connect's settings page on phones**: Connect's own two-column layout
  (section nav plus a narrow content column) breaks at 390 px, and the About
  section shows "Could not load system info" when it cannot reach the
  switchboard. Both are Connect's; nothing in the Sektar shell changes there.
- **Invoice number wraps** in the panel's detail header for long numbers only
  when the actions share the row; actions now wrap below in panels.
- **Meta strip with three items on phones** places the third item alone on a
  second row (two per row). Acceptable; a single-column strip would double
  the height.
- **Drive explorer tiles** (Connect's `FileItem`) do not follow the Sektar
  tokens; they are Connect components inside our page.
- **Top bar at 1100 px** truncates the search placeholder ("Search
  transactio…"); the field still works and the hint is still visible.
- **Board columns** at 1100 px scroll sideways (by design: four status
  columns of 260 px minimum).

## Checked and fine

Dashboard greeting, stat tiles, cash-flow axis, accounts, hero and quick
actions; transactions selector (full and compact), tab counts, feed table with
inline category select; invoice board, cards, panel header, record-payment
dialog, new-invoice form; expense board, stepper, receipts as chips; contacts
pills, rich rows, selected state, panel, edit forms; search dropdown and page;
drive page; drawer open/close; phone search sheet; sign-in placement
(sidebar footer on desktop, top bar on phones); light and dark parity.
