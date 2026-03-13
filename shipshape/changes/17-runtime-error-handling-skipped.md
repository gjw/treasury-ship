# Change Doc: Runtime Error Handling — Skipped Findings

**Category:** 6 — Runtime Error and Edge Case Handling
**Status:** Acknowledged, not pursued

## Relationship to Assignment (GFA Week 4)

The PDF assignment asks to **"fix 3 error handling gaps"** with at least one involving "a real user-facing data loss or confusion scenario." We're targeting U1+U2 (collaboration persistence — data loss), U3 (process-level handlers — server stability), and S2 (WeekReconciliation silent mutations — user confusion). The findings below were evaluated and deliberately skipped.

## E1: Editor Initialization Error Boundary (CRITICAL)

**What it is:** ErrorBoundary wraps only `<EditorContent>`, not TipTap initialization, WebSocket provider setup, or Yjs CRDT sync. If editor init fails, no fallback UI — page hangs or crashes.

**Why skipped:** Extending the ErrorBoundary to wrap the full editor init is architecturally sound but touches the Editor component's initialization flow, which is tightly coupled to the Yjs provider lifecycle. This is a larger refactor than the 3-gap target requires, and the data-loss scenario is already covered by U1+U2 (which addresses the persistence side of the same problem). The current ErrorBoundary at least catches render errors in the editor content area.

**If revisited:** Wrap the entire `HocuspocusProvider` + `TiptapEditor` initialization block in `Editor.tsx` with an ErrorBoundary that shows a "Failed to load editor — reload page" fallback. Include a retry button that re-mounts the component.

## E2-E4: Unprotected Routes (HIGH)

**What they are:** Login, setup, invite, admin, and public feedback routes have no ErrorBoundary. Render errors show React white screen.

**Why skipped:** These are lower-traffic routes. The 3 highest-impact gaps (data loss, server crash, sprint move confusion) are more valuable for the rubric's "technical depth" and "measurable improvement" criteria. Adding ErrorBoundary wrappers to routes is straightforward but doesn't demonstrate root cause understanding — it's just wrapping components.

**If revisited:** Add `<ErrorBoundary>` around the `<Outlet />` equivalent for unauthenticated routes in `main.tsx`. One-line wrapper per route group.

## E5-E6: Tab-Level Error Boundaries and Provider Errors (MEDIUM)

**What they are:** No per-tab error boundaries (13 tab components affected). All top-level providers mount before any ErrorBoundary — provider errors crash the entire app.

**Why skipped:** Same rationale as E2-E4 — these are defensive wrappers, not root cause fixes. The assignment values "genuine understanding of root cause" (25% rubric weight for technical depth). The 3 selected fixes all address specific, traceable failure modes with clear before/after behavior.

## S1, S3-S10: Other Silent Failures (CRITICAL to LOW)

**What they are:** 9 additional silent failure patterns across MyWeekPage (S1), UnifiedDocumentPage (S3), PlanQualityBanner (S4), Editor WebSocket/IndexedDB (S5), WeekOverviewTab (S6), ProgramOverviewTab (S7), IssueSidebar (S8), Dashboard (S9), useWeeklyReviewActions (S10).

**Why skipped:** The assignment asks for 3 fixes. S2 (WeekReconciliation) was chosen because it has the clearest user confusion scenario — 3 of 4 mutations in the same component silently fail, and the 4th (moveAllToBacklog) already has proper error handling, making the inconsistency obvious. The other silent failures are real but lower impact or harder to reproduce for before/after proof.

**If revisited:** S1 (MyWeekPage create mutations) and S3 (UnifiedDocumentPage infinite loading) are the next highest priority. S5 (Editor WebSocket silence) overlaps with the U1+U2 fix on the server side.

## V1-V6: Input Validation Gaps (HIGH to LOW)

**What they are:** Invite accept without Zod validation (V1), unbounded AI content (V2), file upload blocklist (V3), unbounded document content (V4), dynamic SQL structure (V5), manual query param validation (V6).

**Why skipped:** Input validation is important but the assignment specifically scopes Category 6 as "error boundaries, unhandled promise rejections, network failure recovery, malformed input handling, and user-facing error states." The 3 selected fixes directly address the first two (unhandled rejections, error states). Validation hardening would be a strong stretch goal but doesn't deliver the before/after behavior proof the assignment requires as clearly.

## N1-N3: Network Disconnect Recovery (HIGH to MEDIUM)

**What they are:** WebSocket disconnect indicator may not be visible (N1), persistence failure during disconnect cycle (N2 — same as U1+U2), session extend fails immediately with no retry (N3).

**Why skipped:** N2 is addressed by U1+U2. N1 and N3 are real issues but the manual testing in the audit showed network disconnect recovery actually works well (data survived reconnect, WebSocket auto-recovered). These are edge case improvements, not the clear gaps the assignment targets.
