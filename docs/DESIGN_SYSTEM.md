# Design System — Money Tracker (MVP)

## Theme tokens

### Light

- Background: #F8FAFC
- Surface / cards: #FFFFFF
- Border: #E2E8F0
- Text primary: #0F172A
- Text secondary: #475569
- Primary: #2563EB
- Primary hover: #1D4ED8
- Success: #16A34A
- Danger: #DC2626
- Warning: #F59E0B

### Dark

- Background: #0B1220
- Surface: #111827
- Border: #1F2937
- Text primary: #F9FAFB
- Text secondary: #9CA3AF
- Primary: #34D399
- Primary hover: #10B981
- Danger: #F87171
- Warning: #FBBF24
- Success: use Primary (same green) for confirmed positives

## Color rules

- One primary accent only. Don’t introduce extra accents.
- Red only for problem states (overspend, negative forecast).
- Green sparingly: only confirmed positive outcomes (net positive, under forecast).
- Charts neutral and simple unless color indicates meaning.

## Typography

Fonts:

- Headings: Inter Semibold (600)
- Body: Inter Regular (400–500)
- Numbers: JetBrains Mono

Type scale:

- Page title: 28px, weight 700
- Section title: 18px, weight 600
- Body: 16px, weight 500
- Secondary/meta: 13px, color secondary
- Big money numbers (dashboard): 40px, weight 700

## Spacing & radius

- Spacing unit: 8px (use Tailwind spacing in multiples of 2; p-4=16px etc.)
- Card padding: 16px
- Border radius:
  - Inputs/buttons: 12px
  - Cards: 20px
