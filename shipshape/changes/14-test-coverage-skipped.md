# Change Doc: Test Coverage — Skipped Findings

**Category:** 5 — Test Coverage and Quality
**Status:** Acknowledged, not pursued

## Relationship to Assignment (GFA Week 4)

The PDF assignment asks to **"add meaningful tests for 3 previously untested critical paths, or fix 3 flaky tests with documented root cause analysis."** We're targeting the 13 deterministically failing web unit tests (restore CI signal) and the 3 flaky E2E tests (cache invalidation root cause + fix). The findings below were evaluated and deliberately skipped.

## F2: WebSocket Sync + CRDT Conflict Resolution — Zero Coverage (P1)

**What it is:** The core real-time collaboration feature (Yjs CRDT sync over WebSocket) has no tests at either unit or E2E level. `api/src/collaboration/` has 8.5% statement coverage, and the sync protocol and conflict resolution paths are completely untested.

**Why skipped:** Writing meaningful tests for a real-time CRDT sync protocol is a substantial undertaking — it requires standing up WebSocket connections, simulating concurrent edits, and verifying merge behavior. This is not Trench-sized work (would need multiple files, test infrastructure, potentially a test harness for y-websocket). The 3 flaky E2E fixes alone meet the assignment target. WebSocket/CRDT testing would be high-value follow-up work but is out of scope for this sprint.

**If revisited:** Start with a focused integration test: two y-websocket providers connecting to the same document, both making edits, verify merged state. Use the existing testcontainers infrastructure from the E2E suite for PostgreSQL.

## F4: 1 E2E Failure — Inline Comments Highlight (P2)

**What it is:** `inline-comments.spec.ts:118` — "canceling a comment removes the highlight" fails. The test expects comment cancellation to clear highlight styling, but the app doesn't do that. This is a real application bug, not a stale test.

**Why skipped for Cat 5:** This is an app bug, not a test quality issue. Fixing it means changing application code in the comment-cancel handler, which is a Category 6 (error handling) concern. The test itself is correct — it's testing the right behavior, the app just doesn't implement it.

**NOTE (internal):** Chair has additional bugs identified. F4 and those may be bundled into a bug-fix bead later.

## F5-F9: Coverage Gaps and Missing Dependencies (P2-P3)

**What they are:** 40% API / 20% web line coverage (F5), 57% of API routes with no unit tests (F6), 86% of API services untested (F7), comments route zero coverage (F8), `@vitest/coverage-v8` not in devDependencies (F9).

**Why skipped:** These are systemic coverage gaps that can't be meaningfully addressed within the assignment's scope ("3 tests or 3 flaky fixes"). Adding a few tests to uncovered routes wouldn't meaningfully move the coverage numbers, and the assignment explicitly says tests must be "meaningful" (catching real regressions, not just asserting pages load). The 13 failing + 3 flaky fixes deliver more value than adding shallow coverage to untested routes.
