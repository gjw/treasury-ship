# Change Doc: Bundle Size — Route-Level Code Splitting (mgc)

**Bead:** treasury-ship-mgc
**Branch:** task/mgc-route-code-splitting

## Relationship to Assignment (GFA Week 4)

The PDF assignment (Category 2: Bundle Size) asks to **"implement code splitting that reduces initial page load bundle by 20%"**. The audit baseline shows a 2,074 KB monolithic main chunk because all 21 page components are eagerly imported in `web/src/main.tsx`.

This change converts all page-level imports to `React.lazy()` with `Suspense` boundaries, so Vite produces separate chunks per page. The initial bundle drops from 2,074 KB to 471 KB — a **77% reduction**, far exceeding the 20% target.

## Before/After Build Output

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| `index-*.js` (main chunk) | 2,074.27 KB | 470.57 KB | **-1,603.70 KB (-77.3%)** |
| `index-*.js` gzipped | 589.92 KB | 140.70 KB | **-449.22 KB (-76.2%)** |
| Page-level chunks | 0 | 22 | New split chunks |
| Largest page chunk | — | `UnifiedDocumentPage` 404.27 KB | Loads only when editing a document |
| Build succeeds | Yes | Yes | No regressions |
| Type-check passes | Yes | Yes | No type errors |

## What Changed

| File | What was wrong | Fix | Why correct |
|------|---------------|-----|-------------|
| `web/src/main.tsx` | 21 static page imports forced all page code into the main bundle | Replaced with `React.lazy(() => import(...).then(m => ({ default: m.ExportName })))` for each page | Vite splits each lazy import into a separate chunk, loaded on first navigation |
| `web/src/main.tsx` | No Suspense boundaries for lazy components | Added `React.Suspense` around `AppRoutes` and the public feedback route with a loading fallback | React requires Suspense above any lazy component; fallback matches existing loading pattern |
| `web/src/main.tsx` | `AppLayout` kept as eager import | Intentional — it's the shell component rendered on every protected route | Lazy-loading the shell would add latency to every initial page load with no benefit |

## Why static imports were suboptimal

Every `import { Page } from '@/pages/Page'` is a static ES module import. Vite (via Rollup) follows the full import tree of each page and bundles everything reachable into a single chunk. Since `main.tsx` statically imported all 21 pages, the entire application — including the TipTap editor (404 KB), all list views, admin pages, and settings — was bundled into one 2,074 KB file that every user downloaded on first visit, regardless of which page they actually needed.

## Why lazy loading is better

`React.lazy()` converts a static import into a dynamic `import()` call. Vite recognizes dynamic imports as split points and produces separate chunks. The browser only fetches a page's chunk when the user navigates to that route. This means:

1. **Faster initial load** — users download ~471 KB instead of ~2,074 KB before seeing any content.
2. **Pay for what you use** — the admin dashboard (11 KB), org chart (12 KB), and other rarely-visited pages are never downloaded unless needed.
3. **Better cache invalidation** — with a monolith, any change to any page invalidates the entire 2 MB chunk for every user. With code splitting, a fix to the Issues page only invalidates the `Issues-*.js` chunk (~1 KB). All other cached chunks remain valid. Over time, this significantly reduces bandwidth for returning users after deployments.

## Tradeoffs

- **Loading flash on first navigation to each page.** The first time a user visits a route (e.g., `/docs`), the browser fetches that page's chunk. This produces a brief loading state (typically 100-300ms on fast connections). Subsequent visits to the same route are instant (browser-cached). This is a standard and widely-accepted tradeoff in React SPAs.
- **No waterfall risk.** All lazy-loaded components are leaf-level route pages, not nested. There's no scenario where loading one lazy component reveals another lazy component that also needs loading.
- **Named export adapter.** Since all pages use named exports, each `React.lazy()` call uses `.then(m => ({ default: m.PageName }))` to adapt. This is a standard pattern — no runtime cost beyond the one-time module load.

## Deployment & Testing

```bash
# Build and compare
pnpm build                          # Check vite output for split chunks
# Compare: git stash / checkout master, rebuild, note index-*.js size

# Runtime verification
pnpm dev                            # Start dev server
# Open browser DevTools → Network tab → navigate between pages
# Observe: individual chunk files load on first visit to each route

# Automated checks
pnpm type-check                     # Must pass (confirmed)
pnpm test                           # API-side unit tests (unrelated to this change)
```

## What to know for next time

- `AppLayout` is intentionally kept as an eager import — it's the shell for all protected routes. Lazy-loading it would add latency to every page.
- The `useAutoSave` chunk (837 KB) is the largest split chunk. It contains TipTap/Yjs editor infrastructure shared across document editing. This is a candidate for further optimization (bead 2b4: lazy-load heavy deps).
- The `.then(m => ({ default: m.X }))` pattern is needed because all pages use named exports. If pages are ever refactored to use default exports, the adapter can be removed.
