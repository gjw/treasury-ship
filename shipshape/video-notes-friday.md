# Friday Video Notes

## Open these tabs before recording

1. The live app: http://45.33.3.111:5173
2. GitHub repo (your fork)
3. This file (for bullet points)

## Flow (~3-4 min)

### 1. Quick intro (30 sec)

"This is Ship, a project management app built by Treasury. I audited and improved it across all 7 categories. All implementation is complete. Here's what I found and what I did."

### 2. Show the app running (30 sec)

- Click around: dashboard, issues list, a document, the editor
- "It's deployed on a Linode VPS, Postgres in Docker, Express API, React frontend"

### 3. Walk through all 7 categories (2.5 min)

Open `shipshape/changes/` in the repo and flip through:

**Category 1 — Type Safety**
- 522 → 391 violations (**25%+ reduction**, target was 25%)
- Added 3 strict tsconfig flags, eliminated 49 `any` usages, removed 76 unsafe `as X` casts
- Proper type narrowing with runtime guards, not cosmetic

**Category 2 — Bundle Size**
- Route-level code splitting, lazy-loaded emoji picker + highlight.js + diff viewer
- Initial page load bundle reduced by 20%+

**Category 3 — API Response Time**
- Issues endpoint: dropped `content` column from list query, 312KB → ~30KB
- Projects endpoint: replaced 3 correlated subqueries with CTEs
- Both endpoints 20%+ P95 reduction at c=50

**Category 4 — DB Query Efficiency**
- Batched N+1 association inserts: create issue 10→8 queries (20% reduction)
- Batched bulk move: 152→5 queries (97% reduction)

**Category 5 — Test Coverage**
- Fixed 13 deterministically failing web unit tests (stale tab config, stale extension model, session timeout mock)
- Fixed 3 flaky E2E tests — root cause was React Query cache serving stale data after navigation
- 13 failures → 0, 3 flaky → 2 fixed (1 has a deeper Yjs race condition documented)

**Category 6 — Runtime Error Handling**
- Fixed collaboration persistence fire-and-forget — was silently dropping edits if DB write failed. Added .catch() with retry and logging. This was a real data loss scenario.
- Added process-level unhandled rejection/exception handlers — server was crashing silently
- Added onError handlers to 3 WeekReconciliation mutations — sprint moves were failing with no user feedback

**Category 7 — Accessibility**
- All 45 serious axe-core violations were color contrast failures
- Created new `accent-light` token (#3b9bd6, 6.46:1 ratio), fixed muted opacity variants
- My Week 15→0, Dashboard 14→0, Projects List 12→0. **45→0 serious violations**
- Bonus: added ARIA labels to 6 components, focus indicators for ProseMirror editor and context menus

### 4. Wrap (15 sec)

"All 7 categories are implemented with measurable improvements and before/after proof. All that's left is the final report write-up and minor tuning, which we'll be happy to share on Sunday."
