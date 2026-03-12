# Change Doc: Bundle Size — Cumulative Before/After (2ni)

**Bead:** treasury-ship-2ni
**Branch:** task/2ni-bundle-measurement

## Relationship to Assignment (GFA Week 4)

The PDF assignment (Category 2: Bundle Size) asks to **"implement code splitting that reduces initial page load bundle by 20%"** and produce before/after measurement with percentage reductions. This document is the cumulative summary of all bundle work across two implementation tasks (mgc, 2b4).

## Before/After Build Output

### Before (commit `ed1f8b6`, pre-bundle-changes)

```
dist/assets/index-aDwQnTVm.js   2,074.27 KB │ gzip: 589.92 KB
(+ 260 icon/tab chunks, all <17 KB)
Total JS: 2,251.25 KB (689.31 KB gzip)
Chunks: 261
```

One monolithic main bundle containing all 21 pages, TipTap editor, emoji-picker-react, lowlight/highlight.js, and diff-match-patch.

### After (commit `2e0a4e9`, all bundle fixes applied)

```
dist/assets/index-BLRm0bv5.js                  470.57 KB │ gzip: 140.70 KB
dist/assets/useAutoSave-mSor3en0.js             664.16 KB │ gzip: 210.01 KB
dist/assets/emoji-picker-react.esm-MXphEYTC.js  271.11 KB │ gzip:  64.11 KB
dist/assets/index-Du-4IEEA.js (lowlight)        172.22 KB │ gzip:  52.27 KB
dist/assets/UnifiedDocumentPage-BVOOqZ_l.js     114.24 KB │ gzip:  28.12 KB
dist/assets/IssuesList-MRJZwfUV.js               53.96 KB │ gzip:  15.81 KB
dist/assets/Login-_6pSomW8.js                    52.10 KB │ gzip:  10.64 KB
dist/assets/core.esm-BOi8Dmrf.js                 43.70 KB │ gzip:  14.50 KB
dist/assets/DiffViewer-BVpVAmFb.js               20.03 KB │ gzip:   6.72 KB
(+ 287 smaller chunks)
Total JS: 2,273.54 KB (714.74 KB gzip)
Chunks: 296
```

## Key Metrics

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| **Initial page load (index-*.js)** | 2,074.27 KB | 470.57 KB | **-1,603.70 KB (-77.3%)** |
| **Initial page load (gzip)** | 589.92 KB | 140.70 KB | **-449.22 KB (-76.2%)** |
| **Total production bundle** | 2,251.25 KB | 2,273.54 KB | +22.29 KB (+1.0%) |
| **Total production (gzip)** | 689.31 KB | 714.74 KB | +25.43 KB (+3.7%) |
| **Number of chunks** | 261 | 296 | +35 |
| **Largest chunk** | index-*.js (2,074.27 KB) | useAutoSave-*.js (664.16 KB) | **-1,410.11 KB (-68.0%)** |

### 20%+ Initial Load Reduction Target: MET (77.3%)

The initial page load bundle dropped from 2,074 KB to 471 KB — a **77.3% reduction**, nearly 4x the 20% target.

### Why total size increased slightly (+1.0%)

Code splitting adds per-chunk overhead (module wrapper, import boilerplate). The same code is present but distributed across 35 additional chunks, each with a small wrapper. This is expected and irrelevant — total size measures the cost of downloading the *entire* app, which never happens. What matters is initial page load, which dropped 77%.

## Implementation Summary

| Task | Bead | Technique | Impact |
|------|------|-----------|--------|
| Route-level code splitting | mgc | `React.lazy()` for all 21 page components | index-*.js: 2,074 → 471 KB (-77.3%) |
| Lazy-load emoji-picker-react | 2b4 | `React.lazy()` on EmojiPicker component | 271 KB moved to on-demand chunk |
| Lazy-load lowlight/highlight.js | 2b4 | Module-level `import()` with state hook | 172 KB moved to background-loaded chunk |
| Lazy-load diff-match-patch | 2b4 | `React.lazy()` on DiffViewer component | 20 KB moved to on-demand chunk |

## Tests

- **Unit tests:** 451 passed, 0 failed (`pnpm test`)
- **Type check:** Clean (`pnpm type-check`)
- **Build:** Succeeds (`pnpm build`)

## Not Pursued (with justification)

### F4: Build Configuration (sideEffects, manual chunks)

**Acknowledged — not pursued.** Adding `sideEffects: false` to package.json and configuring manual chunk strategies would provide marginal improvement on top of the 77% reduction already achieved. The risk/reward is unfavorable:

- `sideEffects: false` can break code that relies on import side effects (CSS imports, polyfills). Requires careful auditing of every import across the codebase.
- Manual chunk strategies add build config complexity and require ongoing maintenance as dependencies change.
- The 77% initial load reduction already far exceeds the 20% target.

### F6: Tooltip/Popover Library Consolidation

**Acknowledged — not pursued.** The codebase uses both `tippy.js`/`@popperjs/core` (93 KB) and `@floating-ui` (52 KB) — total ~145 KB for overlapping positioning functionality. Not pursued because:

- Both libraries are actively used by different UI frameworks (TipTap uses tippy.js; Radix UI uses floating-ui).
- Consolidating would require rewriting tooltip/popover behavior across both the editor and the component library.
- This is a functionality change, not a bundling optimization — it risks introducing UI regressions.
- The 145 KB is split across lazy-loaded chunks post-code-splitting, so it no longer impacts initial load.

## Deployment & Testing

```bash
pnpm build              # Verify build output matches expected chunk sizes
pnpm test               # 451 tests pass
pnpm type-check         # Clean
pnpm dev                # Start dev server, verify pages load correctly
```

No deployment needed — this is a measurement/documentation task. The actual code changes were deployed via mgc and 2b4.

## What to Know for Next Time

- `useAutoSave-*.js` (664 KB) is now the largest chunk. It contains TipTap/Yjs editor infrastructure shared across all document editing. Further splitting would require restructuring the editor's extension loading.
- Total bundle size is not a meaningful metric for code-split apps. Initial load and per-route sizes are what matter for user experience.
- The before baseline was captured from commit `ed1f8b6` (immediately before the first bundle change). The after was captured from commit `2e0a4e9` (HEAD of master with all changes applied).
