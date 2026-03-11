# Bundle Size Audit

**Date:** 2026-03-09
**Bead:** treasury-ship-2ns
**Branch:** trench-B

## Methodology

### Tools Used

- **Vite 6.4.1** production build (`vite build`) — provides per-chunk sizes with gzip
- **rollup-plugin-visualizer** v5 (`template: 'raw-data'`) — generates JSON treemap of
  every module in the bundle with rendered and gzip sizes
- **grep-based dependency audit** — checked each of the 44 production deps in
  `web/package.json` against actual imports in `web/src/`
- **Manual code review** of `web/src/main.tsx` for route-level code splitting

### Commands

```bash
# Production build (captures chunk sizes)
pnpm build:shared && cd web && npx vite build

# Visualizer build (temporary — installed, ran, uninstalled)
pnpm add -D rollup-plugin-visualizer --filter @ship/web
# Added visualizer plugin to vite.config.ts with template: 'raw-data'
npx vite build    # generates stats.json
# Parsed stats.json with Node scripts to extract per-package sizes
# Reverted vite.config.ts, removed visualizer dep

# Unused dep check
# For each dep in web/package.json dependencies:
#   grep -rl "<dep>" web/src/ --include="*.ts" --include="*.tsx"
```

### Environment

| Property | Value |
|----------|-------|
| Node.js | v20.20.1 |
| Vite | 6.4.1 |
| Platform | darwin-arm64 |
| Build mode | production |
| Minifier | esbuild (Vite default) |
| Tree-shaking | Rollup (Vite default) |
| Manual chunks | None configured |

---

## Baseline Numbers

### Total Build Output

| Asset | Raw | Gzip |
|-------|-----|------|
| `index-*.js` (main chunk) | **2,074 KB** | **589 KB** |
| `index-*.css` | 67 KB | 13 KB |
| Lazy tab chunks (17) | 70 KB combined | 28 KB |
| Icon SVG chunks (245) | 112 KB combined | ~70 KB |
| **Total** | **~2,323 KB** | **~700 KB** |

Vite warns: "Some chunks are larger than 500 kB after minification."

### App Code vs Dependencies

| Category | Raw | Gzip | Share |
|----------|-----|------|-------|
| Dependencies (node_modules) | 3,364 KB | 897 KB | 71.9% |
| App code (web/src/) | 1,318 KB | 294 KB | 28.1% |

### Top 20 Dependencies by Bundle Size

| # | Package | Raw (KB) | Gzip (KB) | % of deps |
|---|---------|----------|-----------|-----------|
| 1 | `emoji-picker-react` | 399.6 | 72.4 | 11.9% |
| 2 | `highlight.js` | 377.9 | 118.5 | 11.2% |
| 3 | `yjs` | 264.9 | 55.5 | 7.9% |
| 4 | `prosemirror-view` | 236.3 | 57.2 | 7.0% |
| 5 | `@tiptap/core` | 181.2 | 36.9 | 5.4% |
| 6 | `react-dom` | 131.7 | 42.4 | 3.9% |
| 7 | `prosemirror-model` | 121.2 | 28.7 | 3.6% |
| 8 | `@uswds/uswds` | 111.7 | 72.3 | 3.3% |
| 9 | `lib0` | 106.5 | 34.0 | 3.2% |
| 10 | `@dnd-kit/core` | 101.0 | 21.1 | 3.0% |
| 11 | `diff-match-patch` | 80.6 | 18.1 | 2.4% |
| 12 | `@tiptap/extension-code-block-lowlight` | 80.0 | 23.3 | 2.4% |
| 13 | `prosemirror-transform` | 79.9 | 18.6 | 2.4% |
| 14 | `react-router` | 79.6 | 19.5 | 2.4% |
| 15 | `@tanstack/query-core` | 77.4 | 20.3 | 2.3% |
| 16 | `tailwind-merge` | 70.3 | 12.1 | 2.1% |
| 17 | `prosemirror-tables` | 70.1 | 16.4 | 2.1% |
| 18 | `linkifyjs` | 59.1 | 20.3 | 1.8% |
| 19 | `y-prosemirror` | 58.7 | 15.4 | 1.7% |
| 20 | `@popperjs/core` | 57.3 | 22.0 | 1.7% |

**TipTap + ProseMirror ecosystem combined:** ~900 KB raw / ~230 KB gzip (26.7% of deps)

**Yjs + lib0 + y-prosemirror combined:** ~430 KB raw / ~105 KB gzip (12.8% of deps)

### Unused Dependencies

| Package | Status | Notes |
|---------|--------|-------|
| `@tanstack/query-sync-storage-persister` | **Installed but unused** | Not imported in web/src/. Not in bundle (tree-shaken). App uses custom IDB persister in `web/src/lib/queryClient.ts` instead. |

All other 43 production dependencies are confirmed imported and present in the bundle.

---

## Findings

### F1: Monolithic Main Chunk — No Route-Level Code Splitting

**Severity: Critical**

All 20+ page components are statically imported in `web/src/main.tsx`. Every page
(Login, Dashboard, Admin, Settings, all document editors, team pages, etc.) is
bundled into the single 2,074 KB main chunk. Users loading the login page download
the entire app.

**Evidence:** Lines 19-39 of `main.tsx` — 20 static page imports, zero `React.lazy()`.

The only code splitting that exists is:

- 13 document tab components via `React.lazy()` in `web/src/lib/document-tabs.tsx`
  (0.2-17 KB each — negligible savings)
- 2 dynamic imports in `SlashCommands.tsx` (upload service, FileAttachment — but
  both are also statically imported elsewhere, so Vite warns they stay in the main chunk)
- 245 USWDS icon SVGs (each gets its own chunk via vite-plugin-svgr — 112 KB total)

### F2: emoji-picker-react — 400 KB for a Single Feature

**Severity: High**

`emoji-picker-react` is the single largest dependency at 399.6 KB raw (11.9% of
all dependency code). It provides emoji selection for document icons — a feature
used occasionally, not on every page load.

### F3: highlight.js via lowlight — 378 KB for Code Blocks

**Severity: High**

`highlight.js` is pulled in by `lowlight` → `@tiptap/extension-code-block-lowlight`.
At 377.9 KB (11.2% of deps), it's the second largest dependency. It loads the
`common` language bundle (40+ languages) via a static import in `Editor.tsx:12`:

```typescript
import { common, createLowlight } from 'lowlight';
```

Code blocks are a niche editor feature — most users will never create one, yet all
users pay the 378 KB cost.

### F4: Default Build Configuration — No Explicit Optimization

**Severity: Medium**

The Vite config (`web/vite.config.ts`) has no `build` section at all. Everything
uses Vite 6 defaults:

- **Minifier:** esbuild (fast but less aggressive than Terser or Closure)
- **Tree-shaking:** Rollup defaults (enabled, but no `sideEffects` hints in any package.json)
- **Chunk strategy:** None — Vite's default is to put all eagerly-imported code
  into one chunk
- **Source maps:** Not generated (default for production — fine)
- **CSS:** Single file, no code splitting (67 KB, reasonable)

No `sideEffects: false` field in any of the three workspace `package.json` files,
which means Rollup can't aggressively tree-shake barrel exports.

### F5: USWDS JS Included but Purpose Unclear

**Severity: Medium**

`@uswds/uswds` contributes 111.7 KB raw to the bundle. The SVG icons from USWDS
are already split into individual chunks (good). The remaining 111.7 KB appears to
be USWDS JavaScript utilities/components. It's unclear how much of this JS is
actually used vs pulled in as a side effect of importing from the package.

### F6: Overlapping Tooltip/Popover Libraries

**Severity: Low**

The bundle includes both:

- `@popperjs/core` (57.3 KB) — used by `tippy.js` (35.8 KB)
- `@floating-ui/core` (26.4 KB) + `@floating-ui/dom` (25.3 KB) — used by Radix UI

Total: ~145 KB for two systems that do the same thing (position floating elements).
Both are actively used by different parts of the codebase.

### F7: diff-match-patch — 81 KB for Content History

**Severity: Low**

`diff-match-patch` at 80.6 KB is loaded eagerly for content diff/history features.
This is a utility feature, not needed on initial page load.

---

## Build Configuration Summary

| Setting | Current Value | Source |
|---------|---------------|--------|
| Minifier | esbuild | Vite 6 default |
| Tree-shaking | Rollup (enabled) | Vite 6 default |
| Manual chunks | None | Not configured |
| Code splitting | Minimal (tabs only) | App code |
| CSS code splitting | Disabled (single file) | Vite 6 default |
| Compression (gzip/brotli) | Computed for reporting only | Not pre-compressed |
| sideEffects hints | None in any package.json | Not configured |
| Source maps | Not generated | Vite 6 default |
| Target | Vite default (esnext) | Not configured |

---

## Code Splitting Inventory

### What IS lazy-loaded (good)

- 13 document tab components (`React.lazy` in `lib/document-tabs.tsx`)
- 245 USWDS icon SVGs (auto-split by vite-plugin-svgr)

### What is NOT lazy-loaded (everything else)

- **All 20+ page components** — statically imported in `main.tsx`
- **Editor + all extensions** — loaded on every page, even non-editor pages
- **emoji-picker-react** — loaded on every page
- **highlight.js** — loaded on every page
- **@dnd-kit** — loaded on every page (only used in kanban/sorting views)
- **diff-match-patch** — loaded on every page (only used in history views)
