# Narration Script — Ship Audit Findings

Target: 3–5 minutes total. Each category slide: ~25–35 seconds.
Read aloud while advancing bullet reveals. Pacing notes in [brackets].

---

## Slide 1: What We Audited (~20s)

We audited Ship across seven categories over three days. Full findings are in the
markdown with methodology, raw data, and reproduction steps. These slides just hit
the high points — the things we should actually fix.

[Advance through bullet list — no narration needed, audience reads along]

---

## Slide 2: Type Safety (~30s)

522 type safety violations total. Two things jump out.

First, the web tsconfig doesn't extend root and is missing three strict flags the
backend has. That means the frontend has weaker type checking — array indexing
returns T instead of T-or-undefined.

Second, there are 27 places where API responses are cast to domain types with no
validation. If the API shape ever changes, those casts silently produce wrong types
at runtime. That's the most dangerous pattern in the codebase.

On the positive side — zero ts-ignore anywhere. Nobody's suppressing the compiler.

---

## Slide 3: Bundle Size (~30s)

The entire app ships in one two-megabyte JavaScript chunk. Every page — login,
dashboard, admin, all the editors — is statically imported. Users loading the login
page download the entire application.

On top of that, the emoji picker alone is 400 kilobytes for a feature used
occasionally. And highlight.js adds another 378K for code blocks most users will
never create.

Route-level code splitting with React.lazy is the single highest-ROI frontend change.

---

## Slide 4: API Response Time (~30s)

We benchmarked five endpoints under load. Four of them are fine — under 50 milliseconds
at P95 even at concurrency 50.

The issues endpoint is the outlier at 177 milliseconds. The root cause is simple: it
returns the full TipTap document content for all 304 issues in one response. That's
312 kilobytes. The SQL query itself is sub-millisecond — the bottleneck is serializing
and transferring all that JSON.

Drop the content column from the list response and you get an estimated 80-plus percent
reduction. The frontend already fetches individual documents separately for editing.

---

## Slide 5: Database Query Efficiency (~30s)

The read paths are actually clean — no N+1 patterns on any of the five flows we
measured. Dashboard, document view, issue list, sprint board, search — all efficient.

The write paths are where the problems are. Creating an issue with three associations
runs three separate INSERT statements instead of one bulk insert. And moving issues
between sprints runs three queries per issue — so moving 50 issues fires 150 queries.
That should be three bulk queries.

Missing compound indexes won't hurt at current scale — 257 documents — but will
matter as data grows.

---

## Slide 6: Test Coverage & Quality (~30s)

1,471 tests across three suites. API unit tests are rock solid — 451 tests, zero
failures, three consecutive green runs.

The problem is on the web side. Thirteen unit tests are deterministically failing —
they weren't updated after a refactor. That's a broken CI signal that masks real
regressions.

More concerning: WebSocket sync and CRDT conflict resolution — the core collaboration
feature — have zero test coverage. No unit tests, no E2E tests. That's the highest-risk
gap in the whole test suite.

---

## Slide 7: Runtime Error Handling (~35s)

Zero console errors during normal use — that's a clean baseline. But there are silent
failures hiding underneath.

The most critical: the collaboration server's persistence calls are fire-and-forget.
If the database write fails when saving a collaborative document, the edits are
silently lost. No retry, no error, no logging. This happens in two places — the
scheduled persist and the cleanup-on-disconnect persist.

There's also no process-level unhandled rejection handler, which means one bad promise
anywhere crashes the entire server with no log output.

On the frontend, ten mutations fail silently — user clicks a button, it spins, resets,
and nothing happened. No error message.

---

## Slide 8: Accessibility (~30s)

Good news: zero critical violations. The app has proper landmark regions, a working
skip-to-content link, correct ARIA tree and tab roles, and visible focus indicators
on most elements.

All 45 serious violations are the same thing — color contrast. Two CSS patterns account
for all of them. The muted text at half opacity on dark backgrounds has a contrast ratio
of 2.26 to 1 — needs to be 4.5 to 1. And the accent blue is too dark for the dark
theme's backgrounds.

Two color token changes fix all 45 violations across all five affected pages.

---

## Slide 9: Stretch (~10s)

And here are five more areas we could audit if time permits.

[Let audience read the bullets — no need to narrate each one]

---

## Slide 10: Summary (~20s)

The foundations are solid. Parameterized SQL everywhere, CRDT-based collaboration that
actually works, good accessibility landmarks, and a stable API test suite.

The "must fix" items are the ones that risk data loss or block scaling — the
fire-and-forget persistence, the monolithic bundle, and the oversized issues response.

Everything's prioritized in the detailed markdown. Start with the must-fix items and
work down.

---

**Total estimated time: ~4 minutes 15 seconds**
