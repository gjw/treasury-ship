# Demo Video Script

Target: 3-5 minutes.

---

**--> Title Slide**

This is ShipShape — an audit and improvement report on Ship, a project management application built for the Department of the Treasury. We audited seven categories and delivered measurable improvements in each, without altering any functionality or changing any part of the stack.

**--> What We Did**

Here's the overview. Each category hit its improvement target. The highlights are a 77% reduction in initial page load, a 97% query reduction on bulk operations, and all 45 accessibility violations eliminated. Let me walk through each one.

**--> Type Safety**

We started with 522 type safety violations and brought that down to 363 — a 30% reduction, exceeding the 25% target. This took five passes. First, we enabled three strict TypeScript flags that were active on the backend but missing from the frontend config. That surfaced over a hundred new errors, which we fixed with runtime guards. Then we went through cast elimination, replacing unsafe `as` casts with proper type guards and discriminated union narrowing. We removed 63 `any` types by creating proper interfaces like `SqlParam` and `ApiIssueResponse`, and we created an `ApiError` class to eliminate a repeated cast-and-mutate pattern across 12 hook files.

One thing worth noting — there were zero `@ts-ignore` or `@ts-nocheck` directives in the codebase, before or after. The original team never suppressed the compiler. But that discipline doesn't mean the types were clean. The lesson here is that getting types right from day one is dramatically easier than going back and fixing them after other architecture already depends on the loose typing.

**--> Type Safety — By The Numbers**

You can see the breakdown here. The biggest wins were in `as` casts — down 100 — and `any` usage, down 63. There were more we could have fixed, but the remaining ones were in test mocks and third-party type declarations where the effort wasn't worth the gain.

**--> Bundle Size**

The application was shipping a single two-megabyte JavaScript bundle. Every page — login, admin, settings, the editor — all loaded on initial page load regardless of which page you actually needed. We got the initial load down to 471 kilobytes — a 77% reduction.

Every page was in one monolithic bundle, so we switched to `React.lazy` on all 21 page components so that each page only loads on demand. Many of those pages — admin, settings, org chart — most users will never visit in a given session. We also lazy-loaded three heavy dependencies: the emoji picker, the syntax highlighting library, and the diff engine. Small changes individually, but they add up in perceived responsiveness.

The total bundle size is unchanged. It's the same code. You just only load what you need, when you need it.

**--> Bundle Size — What Changed**

Here's the breakdown. The red is the original monolith. The green shell is what always loads. Everything else loads on demand — the editor when you open a document, the emoji picker when you click an icon, syntax highlighting in the background.

**--> API Response Time**

We achieved a 23% P95 reduction on the issues endpoint and a 38% reduction on the projects endpoint. These are dependent on data shape, but they're consistent, reproducible improvements.

The issues endpoint was returning the full document content column for every issue in the list — about 300 kilobytes of TipTap JSON that the frontend never renders in list views. Roughly 80% of the payload, serialized for no reason. One line removed.

The projects endpoint was running 45 correlated subqueries — three per project row for sprint counts, issue counts, and inferred status. We replaced those with three common table expressions that compute the aggregates in a single pass per table. Both fixes are tiny. Single file, single query changes, zero frontend impact — just faster responses.

**--> DB Query Efficiency**

This is the most dramatic number. Bulk sprint moves went from 152 queries down to 5. A 97% reduction.

The problem was an N+1 pattern. Delete, insert, update — per issue, in a loop. 50 issues in a sprint means 150 queries plus transaction overhead.

The fix: begin a transaction, delete all 50 associations in one query, insert all 50 in one query, update all 50 properties in one query, commit. Same result, same data integrity, same transaction safety — just batched.

**--> DB Query Efficiency — Bulk Move**

You can see it visually here. The red chain was the per-issue loop. The green chain is the batched version. Five queries regardless of how many issues you're moving.

**--> Test Coverage**

There were 13 web unit tests that were deterministically failing — they'd been broken since earlier refactors and never updated. Nine were from a tab rename, three from a content model change, one from a new CSRF flow the mock didn't handle. All stale tests, not bugs.

There were also three flaky E2E tests — all cache invalidation timing issues. We fixed those with API polling to confirm data persistence before asserting, and full page loads to bypass stale React Query cache.

The pass rate went from 98.8% to 99.8%. More importantly, the suite is now reliable — no false failures masking real regressions.

**--> Runtime Error Handling**

Three gaps fixed, each addressing a different failure mode.

First, data loss. The collaboration server called `persistDocument` without a catch. If the database write failed on disconnect, user edits were silently lost — no log, no retry, just gone. We added a catch with a single retry and structured logging. Single retry because if the database is down, retrying in a loop won't help — but it will catch a transient blip.

Second, silent crashes. There was no process-level handler for unhandled rejections. Any unhandled async error anywhere in the backend would kill the server with zero log output. We added process-level handlers.

Third, stuck UI. Three of four sprint reconciliation mutations had no error handler. If the API call failed, the button stayed permanently disabled with no feedback. The user had no idea the action failed. We added error handlers that reset the button state, and the existing global toast system shows the error message.

**--> Accessibility**

We went from 45 serious violations down to zero. All 45 were color contrast failures. The accent blue was designed for a light theme and never adjusted for the dark theme backgrounds. We introduced a new accent-light color token with a better contrast ratio, well above the WCAG minimum. We replaced sub-threshold opacity variants with full-opacity alternatives.

Beyond the serious violations, we also added five missing ARIA labels, two focus indicators, and accessible text colors for the project chips. Lighthouse scores were already 96 to 100 before our fixes, because Lighthouse scores by audit pass rate, not element count. One failed rule out of 25 audits is still a 96. The violations were real and numerous at the element level, but concentrated in a single rule.

**--> Accessibility — Contrast Fix**

*(advance past — visual reference only)*

**--> How We Worked**

Our process for each category was the same. Measure the baseline, rank findings by severity divided by effort to implement, write a task with clear acceptance criteria. Then implement in an isolated worktree with a change document that includes before and after proof. Review, test, merge.

Measure first, fix second, prove everything.

**--> Philosophy**

We were conservative throughout. No stack changes, no new dependencies, no behavioral changes. Every fix was verified with type checking and tests. Every claim has before and after measurements.

We documented all skipped findings with rationale. There were many more things that could have been improved, but with the constraint of not rearchitecting the application and finishing in six days, we focused on the changes with the best effort-to-impact ratio. And we always targeted root causes, not symptoms.

Proof over promises.

**--> Thank You**

All code, measurements, and documentation are in the repository. Thank you.
