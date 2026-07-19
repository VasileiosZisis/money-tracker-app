# Design System - Money Tracker

This document describes the UI system currently implemented in the app. It is the reference for new screens and component work.

## Design direction

The product should feel like a calm personal finance workspace, not a generic admin panel and not a digital bank clone.

Core traits:

- soft neutral background with lightly tinted surfaces
- restrained teal primary accent
- strong hierarchy around money totals and monthly context
- compact, deliberate spacing with clear grouping and little wasted space
- subtle borders and soft elevation
- desktop-first shell with a left sidebar rail and no persistent desktop top bar
- responsive layouts that collapse cleanly on smaller screens

## Theme tokens

Theme tokens live in `app/globals.css` as CSS variables.

### Light mode

- `--background`: `#edf2f7`
- `--foreground`: `#0b1220`
- `--card`: `rgba(255, 255, 255, 0.96)`
- `--card-foreground`: `#0b1220`
- `--popover`: `#ffffff`
- `--popover-foreground`: `#0b1220`
- `--primary`: `#0f5264`
- `--primary-foreground`: `#f7fcfd`
- `--secondary`: `#d4e0ea`
- `--secondary-foreground`: `#172235`
- `--muted`: `#e4e9ef`
- `--muted-foreground`: `#526176`
- `--accent`: `#cfe6e3`
- `--accent-foreground`: `#0b4654`
- `--destructive`: `#a61b12`
- `--destructive-foreground`: `#fff7f7`
- `--success`: `#0e6b50`
- `--success-foreground`: `#f1fff9`
- `--warning`: `#92570a`
- `--warning-foreground`: `#fffaf0`
- `--info`: `#0f5264`
- `--border`: `rgba(71, 85, 105, 0.34)`
- `--input`: `#b8c6d3`
- `--ring`: `rgba(15, 82, 100, 0.38)`
- `--chart-1`: `#0f5264`
- `--chart-2`: `#b55432`
- `--chart-3`: `#5274a5`
- `--chart-4`: `#7a6aa6`
- `--chart-5`: `#6b7c55`

### Dark mode

- `--background`: `#060c14`
- `--foreground`: `#eef4fa`
- `--card`: `rgba(16, 29, 46, 0.96)`
- `--card-foreground`: `#eef4fa`
- `--popover`: `#111d2d`
- `--popover-foreground`: `#eef4fa`
- `--primary`: `#8fd8cf`
- `--primary-foreground`: `#04110f`
- `--secondary`: `rgba(148, 163, 184, 0.24)`
- `--secondary-foreground`: `#f1f5f9`
- `--muted`: `rgba(148, 163, 184, 0.12)`
- `--muted-foreground`: `#aebacc`
- `--accent`: `rgba(143, 216, 207, 0.24)`
- `--accent-foreground`: `#e8fffc`
- `--destructive`: `#ff8c8c`
- `--destructive-foreground`: `#1a0607`
- `--success`: `#7ddbb5`
- `--success-foreground`: `#04140d`
- `--warning`: `#ffd28b`
- `--warning-foreground`: `#1b1103`
- `--info`: `#8fd8cf`
- `--border`: `rgba(148, 163, 184, 0.30)`
- `--input`: `rgba(148, 163, 184, 0.40)`
- `--ring`: `rgba(143, 216, 207, 0.48)`
- `--chart-1`: `#8fd8cf`
- `--chart-2`: `#f39a72`
- `--chart-3`: `#8fb5e7`
- `--chart-4`: `#b7a2e1`
- `--chart-5`: `#adc68e`

### Contrast hierarchy

- Page backgrounds, cards, inset surfaces, and interactive surfaces must remain visibly distinct in both themes.
- Borders should clearly define cards and controls without becoming the strongest element on the page; input borders are intentionally stronger than standard borders.
- Muted text must remain comfortably readable and should not visually merge with disabled or decorative content.
- Secondary and muted surfaces use neutral gray-blue values; accent surfaces use a visibly greener teal tint so their roles are easy to distinguish.
- Semantic success, warning, and destructive colors must remain distinct from the primary teal and from each other.
- Chart colors may use a broader set of restrained hues because data series must be distinguishable at a glance.
- Background overlays should add depth without washing the page and surface tokens into the same value range.

### Sidebar tokens

- Light mode uses `rgba(255, 255, 255, 0.92)` for `--sidebar`, `#0f5264` for `--sidebar-primary`, `#d9e3ec` for `--sidebar-accent`, and `rgba(71, 85, 105, 0.30)` for `--sidebar-border`.
- Dark mode uses `rgba(11, 22, 36, 0.96)` for `--sidebar`, `#8fd8cf` for `--sidebar-primary`, `rgba(148, 163, 184, 0.18)` for `--sidebar-accent`, and `rgba(148, 163, 184, 0.28)` for `--sidebar-border`.
- Sidebar text and ring colors follow the corresponding foreground and primary theme colors.
- Active navigation uses `--sidebar-primary`; inactive hover states use `--sidebar-accent`.

### Background treatment

The app background is not flat. `body` uses soft radial and linear overlays from CSS variables:

- `--background-spot-1`
- `--background-spot-2`
- `--background-overlay`

Light mode uses `rgba(15, 82, 100, 0.16)`, `rgba(100, 116, 139, 0.22)`, and `rgba(255, 255, 255, 0.28)` respectively. Dark mode uses `rgba(143, 216, 207, 0.16)`, `rgba(51, 65, 85, 0.40)`, and `rgba(6, 12, 20, 0.26)`.

Use the existing background system instead of introducing page-specific gradients without a clear reason.

## Typography

Fonts:

- UI text: Inter
- Numeric emphasis: JetBrains Mono

Hierarchy:

- Page titles: `text-3xl` to `text-4xl`, `font-semibold`, tight tracking
- Major numeric values: mono, `text-4xl` to `text-5xl`
- Section titles: `text-base` to `text-lg`, `font-semibold`
- Body text: `text-sm` or `text-base`, generous line height
- Meta labels: `text-xs` or `text-sm`, muted color, often uppercase tracking when used as an eyebrow

Rules:

- Reserve mono for money amounts, currency figures, and high-signal numeric summaries.
- Keep descriptive copy in muted foreground, not primary text.
- Use uppercase tracked eyebrows sparingly to separate page context from the main heading.

## Spacing

Spacing uses Tailwind's 4px base scale, with 8px increments as the main visual rhythm. The interface should feel compact by default while preserving clear grouping and readable touch targets.

Common spacing patterns:

- Page stack: `gap-5` or `gap-6`
- Standard card padding: `p-5`
- Compact summary and inset-card padding: `p-3` or `p-4`
- Prominent one-off surfaces: `p-6` maximum when the extra space supports hierarchy
- Form stack spacing: `gap-4`
- Dense inline controls: `gap-2` or `gap-3`

Rules:

- Prefer compact, consistent gaps over oversized whitespace.
- Keep filters and supporting controls grouped tightly inside cards.
- Avoid crowding labels, values, or interactive targets even when reducing density.
- Page gutters should generally use `px-3` to `px-5`; avoid `px-6` or larger shell gutters without a specific layout need.

## Radius

The global radius token is `--radius: 0.625rem` (10px).

Practical usage:

- Inputs and buttons: `rounded-lg`
- Pills and badges: `rounded-full`
- Standard cards: `rounded-2xl`
- Small inset panels inside cards: `rounded-xl`
- Icon containers and compact controls: `rounded-lg`
- Large shell surfaces: `rounded-2xl` maximum; the flush sidebar keeps square outer corners

Rules:

- Do not use sharp corners for primary interactive controls or cards.
- Avoid arbitrary pixel radii in page code; use the shared radius scale.
- Reserve `rounded-full` for true pills, status badges, and circular geometry.

## Shadows and elevation

Elevation is defined through CSS variables and mapped in Tailwind:

- `shadow-surface`: primary card elevation
- `shadow-floating`: stronger emphasis for primary buttons, active nav items, and key chips

Light mode shadows use slate at `0.28` and `0.24` alpha. Dark mode shadows use black at `0.70` and `0.62` alpha so elevated surfaces remain visible against the deeper background.

Rules:

- Use borders first, shadows second.
- Keep elevation soft and diffused.
- Avoid stacking multiple strong shadows on the same element.

## Layout principles

### App shell

- Desktop uses the shadcn sidebar pattern with `SidebarProvider`, a full-height flush-left sidebar rail, and the page `main` element as the primary content container.
- Primary navigation lives in the sidebar.
- Desktop sidebar branding should stay concise: app name plus mark, without supporting tagline copy.
- Desktop sidebar nav items should use icon plus single-line labels, not secondary description text.
- Sidebar user identity can show avatar and display name, but should avoid extra metadata lines unless they are genuinely necessary.
- Desktop sidebar user identity and utility controls should visually reuse the same row treatment as the primary nav links: matching spacing, icon box sizing, corner radius, and hover language.
- Desktop sidebar utility controls such as sign-out and theme toggle should sit in the sidebar footer/menu area after the account identity block.
- The desktop sidebar should sit flush against the left edge, span the full viewport height, and use square outer corners instead of an inset card treatment.
- Desktop content should start directly in the page body without a shell-level top bar.
- Main content should use the full available width inside the shell, with individual pages deciding their own internal width constraints where needed.

### Mobile behavior

- Mobile uses the same shadcn sidebar as an off-canvas drawer.
- The mobile drawer should also open edge-to-edge without outer padding or rounded outer corners.
- The page body should expose a compact trigger row so the off-canvas sidebar is reachable on small screens.
- Keep actions reachable without requiring dense toolbars.
- Tables should degrade into stacked cards where needed.

### Dashboard composition

- Lead with the selected month and the net result.
- In Monthly Snapshot, place Income total, Expense total, and Projected net left—in that order—in one secondary metric row below Net left now and before the cash-flow chart. Mirror the Total Balance primary/secondary metric structure, use `gap-6` between secondary metrics, and render secondary values at `text-xl` so both lead cards align visually.
- Dashboard composition uses four distinct responsive rows: Total Balance with Monthly Snapshot (`md` two-column), the three forecast metrics (`md` three-column), Needs Attention at full width, and Recent Transactions with Planned Bills and Planned Income (`xl` three-column). All rows stack on smaller screens while preserving that content order.
- Safe to spend, Daily safe spend, and Forecast remaining spend use compact metric cards without descriptive text beneath their values.
- Use a `Planning & Forecast` section heading above the three forecast metric cards and Needs Attention to distinguish planning-oriented information from Total Balance and Monthly Snapshot.
- The Needs Attention card lists actionable signals without a numeric count badge in its header.
- Support the main number with income, expense, and ratio-based context derived from existing data.
- Vertically center summary-card icons against their paired label and value block.
- A line chart is acceptable in the lead dashboard card when it is directly grounded in real monthly data, such as day-by-day cumulative income and expense progress for the selected month.
- In light mode, chart grid lines should read slightly darker than default border treatments so quantitative guides remain legible against bright card surfaces.
- Keep recent transactions visible and legible.
- Do not invent analytics or charts that are not backed by real data.

## Component styling principles

### Buttons

- Use `components/ui/button.tsx`.
- Primary buttons are solid teal with floating elevation.
- Outline buttons use border plus card background.
- Icon-only actions use rounded square buttons, not circular chrome.

### Cards

- Use `components/ui/card.tsx`.
- Cards are translucent, lightly blurred, bordered, and elevated.
- In light mode, card and icon-container borders should read a touch stronger than default shadcn neutrals so they do not wash out against the pale surface stack.
- Nested content blocks inside cards use a lower-contrast background rather than another full shadow stack.

### Inputs, selects, and textareas

- Use `components/ui/input.tsx`, `components/ui/select.tsx`, and `components/ui/textarea.tsx`.
- Inputs and selects use `h-10`; default buttons use `h-9`, with `h-10` for prominent actions.
- Inputs use subtle inset highlight, soft border, and a 3px ring on focus.
- Avoid browser-default form styling in page code.

### Badges

- Use badges for status, filter chips, and compact metadata.
- Semantic badges:
  - success for income and positive states
  - destructive for expense-heavy or negative states
  - outline for neutral metadata
  - accent for highlighted secondary context

### Empty states

- Use `components/ui/empty-state.tsx`.
- Empty states should include:
  - a clear title
  - one sentence of context
  - an action when the next step is obvious

### Tables and lists

- Desktop tables should use compact but legible row padding, muted headers, and a subtle hover background.
- Mobile should prefer stacked cards over forcing wide tables.
- Use badges and mono values to improve scannability.

### Overlays

- Sheets and dialogs should reuse the same surface language:
  - muted overlay
  - bordered card or panel
  - rounded corners
  - soft elevation

## shadcn/ui usage guidelines

This project uses shadcn-style primitives with Tailwind and CSS variables. Reuse the shared components instead of hand-rolling one-off variants.

Preferred primitives:

- `Button`
- `Card`
- `Badge`
- `Input`
- `Select`
- `Textarea`
- `Progress`
- `EmptyState`

Guidelines:

- Extend primitives through variants or wrapper components before adding page-only style chains.
- Keep semantic meaning in component usage. Example: use `Badge` for type/status, not as a generic container.
- New pages should compose from the shell plus primitives, not bypass them with raw HTML styling.

## Color usage rules

- Primary teal is the only strong general-purpose UI accent.
- Additional restrained hues are allowed only for chart series where differentiation is functional.
- Success and destructive are semantic, not decorative.
- Keep surfaces neutral and let money figures carry emphasis.
- Do not introduce bright gradient-heavy widgets unless they support a real information hierarchy and stay consistent with the app shell.

## Do and do not

Do:

- prioritize monthly context, clarity, and trust
- keep actions obvious but visually restrained
- use mono numerals for important amounts
- preserve a compact rhythm while keeping sections easy to scan

Do not:

- build generic admin-dashboard chrome
- add fake widgets or unsupported analytics
- mix unrelated visual styles across pages
- hardcode new hex colors directly in components
