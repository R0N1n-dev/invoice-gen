# Billfold — planning document

Offline-first invoice generator. Vue 3 + Vite 8 + Capacitor 8, Android-first, works as a PWA on web/desktop.

## 1. Product scope

| Area | Capabilities |
| --- | --- |
| Dashboard | Outstanding / paid / overdue totals, 6-month revenue bars, status breakdown, recent activity, quick actions |
| Invoices | Create / edit / duplicate / delete, drafts, line items with qty + unit + price + per-line discount + per-line tax rate, invoice-level discount, shipping, multi-currency, issue & due dates, PO number, notes, terms, payment instructions, auto numbering (`INV-2026-0007`), status machine (draft → sent → partial → paid → overdue / void), payments ledger with partial payments, mark-as-paid |
| Clients | CRUD, company, contact, billing address, tax/VAT id, email/phone, per-client currency + payment terms, invoice history, outstanding balance |
| Catalog | Reusable products/services with unit, default price, tax rate, description |
| PDF | Client-side A4 PDF via `pdf-lib`, 3 print layouts (modern / classic / minimal), logo, brand accent, live in-app preview, native save to Documents, native share sheet, print |
| Business profile | Name, logo, address, tax id, bank details, default currency/locale, invoice prefix, default tax rate, default terms |
| Settings | Currency + locale + date format, numbering, theme, accent, data export/import (JSON), sample data, wipe |
| Android | Status bar theming, splash screen, Android hardware back button routing, share sheet, save to Documents, keyboard resize handling, safe-area insets, file provider uri sharing — **no haptics anywhere** |
| Web/PWA | localStorage fallback, download PDF, Web Share API, installable |

## 2. Architecture

```
src/
  main.ts                 bootstrap, native shell init
  App.vue                 layout shell (desktop sidebar / mobile tab bar)
  router/                 hash history routes
  stores/                 pinia: business, clients, invoices, catalog, settings, ui
  lib/                    money, dates, id, storage (Capacitor Preferences + localStorage), pdf, native, seed
  components/             AppIcon, AppSheet, AppModal, EmptyState, StatusPill, MoneyText, LineItemRow, ...
  views/                  Dashboard, Invoices, InvoiceEditor, InvoiceDetail, Clients, Catalog, Settings, Onboarding
  styles/                 tokens.css (theme vars), print.css
mockups/                  static design directions + screenshots
```

- **State**: Pinia setup stores; persistence is debounced through a `storage` adapter that uses `@capacitor/preferences` on native and `localStorage` on web.
- **Money**: integer minor units (`amount * 100`) end-to-end, `Intl.NumberFormat` for display, no float drift.
- **PDF**: `pdf-lib` (pure JS, no WebView canvas quirks), embed logo PNG/JPEG bytes, embed Helvetica standard fonts, A4 595×842pt. Layout engine lives in `lib/pdf/` and is shared by the on-screen preview (same geometry scaled).
- **Native**: `lib/native.ts` is the only place that touches Capacitor plugins. Every call is guarded by `Capacitor.isNativePlatform()` with a web fallback (download link / Web Share / `window.print`).
- **No haptics**: no `@capacitor/haptics` dependency, no `navigator.vibrate` calls anywhere.

## 3. Android specifics
- `@capacitor/app` `backButton` listener: close open sheet/modal → pop route → exit app from root.
- `@capacitor/status-bar`: style follows theme (dark content on light themes), overlay disabled so content never sits under the bar.
- `@capacitor/keyboard`: `resize: native` (default) + `scrollAssist`, hide scrollbar in editors.
- Safe areas via `env(safe-area-inset-*)` + Capacitor `contentInset`.
- Files written to `Directory.Documents/Billfold/` — visible in Files app, shared with `@capacitor/share` using `file://` uri.
- Splash + status bar colors match the selected theme, updated at runtime.

## 4. Delivery steps
1. Scaffold + design direction mockups (4 directions, 4 screens each) → **user picks**.
2. Design tokens for chosen direction, app shell + navigation.
3. Data layer (stores, storage, seed), dashboard.
4. Invoice editor + detail + payments + status machine.
5. Clients + catalog.
6. PDF engine + preview + native export/share/print.
7. Settings, backup/restore, onboarding.
8. Capacitor Android platform, plugin config, back-button behaviour.
9. Build, typecheck, headless smoke test (PDF bytes valid, navigation, CRUD).
