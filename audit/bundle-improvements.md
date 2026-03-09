# Bundle Improvement Ideas

Collected during the bundle audit (treasury-ship-2ns). Ranked by estimated impact.

---

## High Impact

### Route-level code splitting (addresses F1)

Convert all page imports in `main.tsx` to `React.lazy()`. Split pages into at least
3 groups: auth (login/setup/invite), main app (dashboard, docs, issues, projects),
and admin. The editor and its heavy deps (TipTap, Yjs, ProseMirror) would only load
when navigating to a document page.

**Estimated savings:** 500-800 KB off initial load (gzip), depending on grouping.

### Lazy-load emoji-picker-react (addresses F2)

The emoji picker is triggered by a user click on the document icon. Dynamic
`import()` when the picker opens would remove 400 KB from the main chunk.

**Estimated savings:** ~72 KB gzip off initial load.

### Lazy-load lowlight/highlight.js (addresses F3)

Import `lowlight` dynamically when a code block is first created or focused, not
at Editor mount. Or switch from `common` (40+ languages) to a custom subset of
5-10 languages actually used.

**Estimated savings:** ~118 KB gzip off initial load.

---

## Medium Impact

### Add sideEffects: false to package.json files (addresses F4)

Adding `"sideEffects": false` (or a minimal list) to the workspace `package.json`
files helps Rollup tree-shake unused re-exports more aggressively.

### Manual chunk strategy (addresses F4)

Configure `build.rollupOptions.output.manualChunks` to separate:

- `vendor-react` — react, react-dom, react-router
- `vendor-editor` — tiptap, prosemirror, yjs, y-prosemirror
- `vendor-ui` — radix, cmdk, dnd-kit, tippy

This improves caching — vendor chunks change less often than app code.

### Audit @uswds/uswds JS usage (addresses F5)

Determine if the 112 KB of USWDS JS is actually needed or if the app only uses the
CSS/icons. If only CSS, the JS can be excluded.

---

## Low Impact

### Consolidate tooltip/popover libraries (addresses F6)

Long-term: migrate either tippy.js → Radix tooltips or vice versa to eliminate one
floating-element positioning library. ~90 KB savings but significant refactoring.

### Lazy-load diff-match-patch (addresses F7)

Dynamic import when content history view is opened. ~18 KB gzip savings.

### Remove unused dependency

`@tanstack/query-sync-storage-persister` is installed but not imported. Safe to
remove from `web/package.json`. Zero bundle impact (already tree-shaken out) but
reduces install size and dependency surface.

### Consider Terser minifier

Switch from esbuild to Terser for production builds (`build.minify: 'terser'`).
Terser produces ~5-10% smaller output at the cost of slower builds. Evaluate
whether the savings justify the build time tradeoff.
