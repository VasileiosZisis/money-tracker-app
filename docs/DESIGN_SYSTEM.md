# Design System - Money Tracker

This document describes the UI system currently implemented in the app. It is the reference for new screens and component work.

## Design direction

The product should feel like a calm personal finance workspace, not a generic admin panel and not a digital bank clone.

Core traits:

- soft neutral background with lightly tinted surfaces
- restrained teal primary accent
- strong hierarchy around money totals and monthly context
- roomy but controlled spacing
- subtle borders and soft elevation
- desktop-first shell with left sidebar and utility top bar
- responsive layouts that collapse cleanly on smaller screens

## Theme tokens

Theme tokens live in `app/globals.css` as CSS variables.

### Light mode

- `--background`: `#f4f7fb`
- `--foreground`: `#0f172a`
- `--card`: `rgba(255, 255, 255, 0.88)`
- `--card-foreground`: `#0f172a`
- `--popover`: `#ffffff`
- `--popover-foreground`: `#0f172a`
- `--primary`: `#15586b`
- `--primary-foreground`: `#f8fcfd`
- `--secondary`: `#eef3f8`
- `--secondary-foreground`: `#1e293b`
- `--muted`: `#eef3f7`
- `--muted-foreground`: `#5b6b80`
- `--accent`: `#e5f1f1`
- `--accent-foreground`: `#134e5e`
- `--destructive`: `#b42318`
- `--destructive-foreground`: `#fff5f5`
- `--success`: `#14785c`
- `--success-foreground`: `#f2fbf8`
- `--warning`: `#b7791f`
- `--warning-foreground`: `#fff9ef`
- `--info`: `#15586b`
- `--border`: `rgba(148, 163, 184, 0.22)`
- `--input`: `#d6e0e9`
- `--ring`: `rgba(21, 88, 107, 0.24)`

### Dark mode

- `--background`: `#08111c`
- `--foreground`: `#e5edf5`
- `--card`: `rgba(12, 23, 38, 0.88)`
- `--card-foreground`: `#e5edf5`
- `--popover`: `#0d1724`
- `--popover-foreground`: `#e5edf5`
- `--primary`: `#78b8b0`
- `--primary-foreground`: `#07111b`
- `--secondary`: `rgba(148, 163, 184, 0.12)`
- `--secondary-foreground`: `#e2e8f0`
- `--muted`: `rgba(148, 163, 184, 0.10)`
- `--muted-foreground`: `#94a3b8`
- `--accent`: `rgba(120, 184, 176, 0.16)`
- `--accent-foreground`: `#d7f5f0`
- `--destructive`: `#f87171`
- `--destructive-foreground`: `#160809`
- `--success`: `#64c29c`
- `--success-foreground`: `#07150f`
- `--warning`: `#f7c77a`
- `--warning-foreground`: `#1b1306`
- `--info`: `#78b8b0`
- `--border`: `rgba(148, 163, 184, 0.16)`
- `--input`: `rgba(148, 163, 184, 0.20)`
- `--ring`: `rgba(120, 184, 176, 0.30)`

### Sidebar tokens

- `--sidebar`: translucent surface used by the desktop rail
- `--sidebar-primary`: active nav background
- `--sidebar-accent`: hover background for inactive nav items
- `--sidebar-border`: border treatment for the rail

### Background treatment

The app background is not flat. `body` uses soft radial and linear overlays from CSS variables:

- `--background-spot-1`
- `--background-spot-2`
- `--background-overlay`

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

Spacing follows an 8px rhythm with Tailwind spacing utilities.

Common spacing patterns:

- Page stack: `space-y-6` or `space-y-8`
- Card padding: `p-5`, `p-6`, or `p-7`
- Form stack spacing: `gap-5`
- Dense inline controls: `gap-2` or `gap-3`

Rules:

- Prefer fewer, larger gaps over many micro-gaps.
- Keep filters and supporting controls grouped tightly inside cards.
- Avoid collapsing content into crowded table rows or form blocks.

## Radius

The global radius token is `--radius: 1rem`.

Practical usage:

- Inputs and buttons: `rounded-xl`
- Pills and badges: `rounded-full`
- Standard cards: `rounded-3xl`
- Small inset panels inside cards: `rounded-[22px]` to `rounded-[24px]`
- Large shell surfaces: `rounded-[28px]` to `rounded-[32px]`

Rules:

- Do not use sharp corners.
- Do not over-round everything into toy-like shapes.
- Reserve the largest radii for shell chrome and major summary surfaces.

## Shadows and elevation

Elevation is defined through CSS variables and mapped in Tailwind:

- `shadow-surface`: primary card elevation
- `shadow-floating`: stronger emphasis for primary buttons, active nav items, and key chips

Rules:

- Use borders first, shadows second.
- Keep elevation soft and diffused.
- Avoid stacking multiple strong shadows on the same element.

## Layout principles

### App shell

- Desktop uses a left sidebar rail starting at `lg`.
- Primary navigation lives in the sidebar.
- A utility top bar sits above page content.
- Main content is constrained to a centered readable width inside the shell.

### Mobile behavior

- Sidebar collapses into a horizontal nav strip inside the top bar.
- Keep actions reachable without requiring dense toolbars.
- Tables should degrade into stacked cards where needed.

### Dashboard composition

- Lead with the selected month and the net result.
- Support the main number with income, expense, and ratio-based context derived from existing data.
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
- Nested content blocks inside cards use a lower-contrast background rather than another full shadow stack.

### Inputs, selects, and textareas

- Use `components/ui/input.tsx`, `components/ui/select.tsx`, and `components/ui/textarea.tsx`.
- Controls should be at least `h-11`.
- Inputs use subtle inset highlight, soft border, and 4px ring on focus.
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

- Desktop tables should breathe: larger row padding, muted headers, subtle hover background.
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

- Primary teal is the only strong accent.
- Success and destructive are semantic, not decorative.
- Keep surfaces neutral and let money figures carry emphasis.
- Do not introduce bright gradient-heavy widgets unless they support a real information hierarchy and stay consistent with the app shell.

## Do and do not

Do:

- prioritize monthly context, clarity, and trust
- keep actions obvious but visually restrained
- use mono numerals for important amounts
- preserve roomy spacing on larger screens

Do not:

- build generic admin-dashboard chrome
- add fake widgets or unsupported analytics
- mix unrelated visual styles across pages
- hardcode new hex colors directly in components
