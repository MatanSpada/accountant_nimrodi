# Redesign Plan

## New Page Structure

### Navigation (sidebar)
```
נמרודי ושות׳          ← brand name only, no paragraph
──────────────────
דשבורד               ← /
עסקאות חדשה          ← /admin/payments/new
עסקאות               ← /admin/payments
──────────────────
[logout button]
```
Remove sidebar footnote. Reduce sidebar to 240px. Active state: left/right border accent + subtle fill, no border on inactive.

### Pages
| Page | Route | Purpose |
|------|-------|---------|
| דשבורד | `/` | Executive overview — KPIs, status chart, recent activity |
| בקשת תשלום חדשה | `/admin/payments/new` | Focused form, centered max-width |
| עסקאות | `/admin/payments` | Full table, polished rows |
| פרטי עסקה | `/admin/payments/:id` | Status-first layout, business info top, technical collapsed |
| סטטוס מערכת | `/admin/settings/client-requirements` | Tucked away, secondary feel |

## Visual System Direction

### Colors — shift to cooler, more executive
```
--bg:        #f2f4f7      ← cooler neutral (was warm beige)
--surface:   #ffffff
--surface-soft: #f7f8fa
--ink:       #0f1923      ← near-black, cooler
--ink-soft:  #5a6478
--ink-faint: #8d97a5
--line:      #e2e6ec
--brand:     #1e3a5f      ← deeper navy (was #23384f)
--brand-light: #2c5282
--brand-soft:  #e8eef6
--accent:    #2563eb      ← electric blue for KPI highlights
--success:   #16a34a
--warning:   #d97706
--danger:    #dc2626
--sidebar-bg: #111827     ← near-black sidebar (Power BI style)
```

### Typography
- Sidebar nav: 0.875rem, medium weight
- Page title (topbar): 1.5rem, semibold — no kicker text
- Section headers: 0.75rem uppercase, tracked, --ink-faint (like Power BI section labels)
- KPI value: 2rem–2.5rem, bold
- KPI label: 0.8rem, --ink-faint
- Table header: 0.75rem, uppercase, tracked
- Body: 0.9rem, 1.6 line-height

### Spacing scale
- 4, 8, 12, 16, 20, 24, 32, 48px
- Main padding: 32px (desktop), 20px (mobile)
- Card padding: 20px (compact operational), 24px (dashboard)
- Section gap: 20px

### Cards
- Dashboard KPI cards: no border, subtle shadow, white, 16px radius
- Operational cards: 1px border #e2e6ec, 12px radius, no shadow
- Card no longer needs section-head `<p>` description text

### Sidebar
- Background: #111827 (near-black)
- Nav items: no border, no background on inactive — just color change on hover
- Active: 2px right-side (or left in RTL) accent bar + #1e3a5f fill + white text
- Logo: brand name only, small caps, letter-spaced

## Dashboard Redesign (Phase 4)

Layout:
```
┌─────────────────────────────────────────────┐
│  [page title: דשבורד]                        │
├──────────┬──────────┬──────────┬────────────┤
│ Total    │ Paid     │ Pending  │ Amount paid│
│ Requests │ Count    │ Count    │            │
├──────────┴──────────┴──────────┴────────────┤
│  Recent Payments (simplified table)          │
│                              [all →]         │
├────────────────────┬────────────────────────┤
│  Status Breakdown  │  Quick Actions          │
└────────────────────┴────────────────────────┘
```

KPI cards sit in a 4-col row at the top, no wrapping card around them.
Recent payments table is simplified: just name, amount, status, date — not 8 columns.
Status breakdown uses horizontal mini-bars (like Power BI).

## Redesign Priorities (in order)

1. **Remove all hero sections** — immediate noise reduction
2. **KPI row on dashboard** — moved out of card wrapper, top of page
3. **Sidebar** — color + spacing + remove explanatory text
4. **Typography system** — section headers become small-caps labels
5. **Dashboard layout** — simplified recent table + breakdown side-by-side
6. **Form page** — centered max-width 640px, remove hero
7. **Payments list** — cleaned table, status pill polish, compact rows
8. **Payment details** — status prominent at top, technical collapsed cleanly
9. **Context row** — move env/mode info to sidebar footnote (one line, subtle)
10. **Polish** — transitions, hover states, empty states

## What Stays Technically Unchanged
- All routes and route handlers
- All business logic (service layer, repositories)
- All form POST endpoints
- JavaScript for copy-to-clipboard and mock simulator
- Hebrew RTL layout
- CI/CD configuration
- Dev tools (just visually deprioritized under disclosure)
