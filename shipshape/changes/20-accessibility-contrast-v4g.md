# Change Doc: Accessibility — Color Contrast Fixes (v4g)

**Category:** 7 — Accessibility Compliance
**Bead:** v4g

## Relationship to Assignment

> "Fix all Critical/Serious violations on the 3 most important pages."

All 45 serious axe-core color-contrast violations across My Week (15), Dashboard (14), and Projects List (12) are now resolved. After: 0 serious violations on all 3 pages, plus no regressions on Issues List or Documents List.

## Before/After axe-core Results

| Page | Serious (Before) | Serious (After) |
|------|-------------------|-----------------|
| My Week | 15 | 0 |
| Dashboard | 14 | 0 |
| Projects List | 12 | 0 |
| Issues List | 0 | 0 |
| Documents List | 0 | 0 |

## Color Values and Contrast Ratios

| Token | Hex | On #0d0d0d | On bg-accent/20 (#0a1d2b) |
|-------|-----|------------|---------------------------|
| accent (existing) | #005ea2 | 3.07:1 (FAIL) | 2.55:1 (FAIL) |
| **accent-light (new)** | **#3b9bd6** | **6.46:1** | **5.48:1** |
| muted (existing, full) | #8a8a8a | 5.55:1 | — |
| muted/50 (was) | ~#4d4d4d | 2.26:1 (FAIL) | — |
| muted/60 (was) | ~#5a5a5a | 2.73:1 (FAIL) | — |

Pattern C: Changed `bg-muted/30` → `bg-muted/10` on FilterTabs inactive count badge. `text-muted` on `bg-muted/10` (#191919) = 5.11:1 (passes).

## Per-File Change Table

| File | Changes |
|------|---------|
| `web/tailwind.config.js` | Added `accent-light: '#3b9bd6'` color token |
| `web/src/pages/MyWeekPage.tsx` | L122, L345: `text-accent` → `text-accent-light`; L228, L290: `text-muted/50` → `text-muted` |
| `web/src/pages/Dashboard.tsx` | L370: `text-accent` → `text-accent-light` (ICE score) |
| `web/src/components/dashboard/DashboardVariantC.tsx` | L74, L261: `text-muted/60` → `text-muted`; L195, L307: `text-muted/50` → `text-muted`; L195, L317: `text-accent` → `text-accent-light` |
| `web/src/pages/Projects.tsx` | L338, L525: `text-accent` → `text-accent-light` |
| `web/src/components/FilterTabs.tsx` | L43: `bg-muted/30` → `bg-muted/10` |

## Tradeoffs

- **accent-light (#3b9bd6) vs changing accent itself**: Chose a new token to avoid cascading changes across the entire app. Only the 3 target pages use accent-light; other pages keep the original accent blue. Future work (bead do2 or beyond) can migrate remaining text-accent uses.
- **Pattern B: text-muted vs new token**: Using full-opacity muted (#8a8a8a) is visually slightly more prominent than the /50 and /60 variants. Acceptable tradeoff — the old opacity values were functionally invisible on dark backgrounds.
- **Pattern C: darkening bg vs lightening text**: Chose to darken `bg-muted/30` → `bg-muted/10` rather than introducing another text token. The pill shape is subtler but still visible.
