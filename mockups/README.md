# Billfold — UI directions

Four high-fidelity design directions for the invoice generator. Each file is a static,
self-contained prototype showing the same four screens at 390 × 844:

1. **Dashboard** — outstanding balance, stats, recent activity
2. **Invoice list** — search, filters, grouped rows
3. **Invoice editor** — client, dates, line items, discounts, tax, total
4. **PDF preview** — the generated A4 document with share / save actions

| Direction | File | Mood |
| --- | --- | --- |
| A · Ledger | `ledger.html` | Warm paper, forest green, serif numerals, hairline rules |
| B · Slate | `slate.html` | Dark, gradient hero, mono figures, status rails |
| C · Bloom | `bloom.html` | Soft lilac/peach, big radii, floating pill nav, collection ring |
| D · Swiss | `swiss.html` | Strict grid, black rules, mono labels, vermilion accent |

Screenshots are in `shots/`. Open `index.html` for the chooser page.

## Viewing

Any static server will do:

```bash
cd mockups && python3 -m http.server 8123
# http://localhost:8123/index.html
```

## Re-rendering screenshots

```bash
tools/shots/render.sh            # all directions
tools/shots/render.sh bloom.html # one direction
```

Fonts are vendored under `fonts/` (Inter, Instrument Serif, Bricolage Grotesque,
Plus Jakarta Sans, JetBrains Mono, Archivo — all SIL OFL).
