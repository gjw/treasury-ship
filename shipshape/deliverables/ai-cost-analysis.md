# AI Cost Analysis

ShipShape — Auditing and Improving a Production TypeScript Codebase

---

## 1. Development Costs

### Tools Used

| Tool | Provider | Model(s) | Role |
|------|----------|----------|------|
| Claude Code (CLI) | Anthropic | Claude Opus 4.6 | 100% of code authoring, auditing, planning, writing |

No other AI tools were used. No OpenAI, no Copilot, no Cursor. The entire project — audit, implementation, documentation — was executed through Claude Code using a multi-agent workflow with specialized role prompts (planning, implementation, writing) running as separate Claude Code sessions.

### Claude Code Usage

Data from Claude Code session tracker (`cost-summary.py`), scoped to this project directory and its worktrees. 22 sessions across 7 days.

| Date | Phase | Prompts | Output Tokens | Cache Read | Active Time | Cost (USD) |
|------|-------|---------|---------------|------------|-------------|------------|
| Mar 9 (Mon) | Intro / Audit | 261 | 39,535 | 11,674,961 | 20m 50s | $29.02 |
| Mar 10 (Tue) | Audit | 24 | 2,699 | 1,124,818 | 2m 52s | $4.02 |
| Mar 11 (Wed) | Implementation | 108 | 20,484 | 5,541,639 | 10m 2s | $17.25 |
| Mar 12 (Thu) | Implementation | 839 | 141,113 | 63,870,922 | 1h 11m | $145.76 |
| Mar 13 (Fri) | Impl / Doc | 595 | 123,259 | 35,794,821 | 1h 10m | $98.43 |
| Mar 14 (Sat) | Doc / Polish | 259 | 53,117 | 17,303,524 | 25m 48s | $79.36 |
| Mar 15 (Sun) | Doc / Polish | 19 | 3,927 | 1,584,380 | 2m 0s | $3.66 |
| **Total** | | **2,105** | **384,134** | **136,895,065** | **3h 23m** | **$377.50** |

Timestamps are recorded in UTC; dates may shift by one day for late-night CDT sessions.

Model: Claude Opus 4.6 (100% of sessions)

### Token Breakdown

| Token Category | Count | Rate | Est. Cost |
|----------------|-------|------|-----------|
| Input tokens (fresh) | 22,762 | $15.00/M | $0.34 |
| Cache write | 7,626,871 | $18.75/M | $143.00 |
| Cache read | 136,895,065 | $1.50/M | $205.34 |
| Output tokens | 384,134 | $75.00/M | $28.81 |
| **Total** | **144,928,832** | | **$377.50** |

**94.5% of all tokens were cache reads** — the agent re-reading project context (CLAUDE.md, role prompts, source files) on every prompt. At the cache read rate ($1.50/M), this context overhead costs $205 instead of the $2,053 it would cost at the full input rate.

### Pre-Existing Infrastructure Costs

Our fork is deployed on a Linode VPS. These costs are pre-existing and shared with other projects — they are not costs incurred for ShipShape.

| Service | Purpose | Monthly Cost | Notes |
|---------|---------|-------------|-------|
| Linode VPS (4GB Dedicated) | App server + PostgreSQL | $48/mo | Shared with other projects — not a ShipShape-specific cost |

### Total Project Cost Summary

| Line Item | Cost | Notes |
|-----------|------|-------|
| Anthropic API (Claude Opus 4.6 via Claude Code) | $377.50 | 22 sessions, 2,105 prompts, 3h 23m active time |
| OpenAI / other LLM providers | $0 | Not used |
| Copilot / Cursor / other coding agents | $0 | Not used |
| **Total project AI cost** | **$377.50** | **100% Anthropic** |

**Cost per category (estimated):** With 7 categories of roughly equal scope, the average cost per audited-and-improved category is ~$54. The heaviest days (Mar 12-13, $244 combined) correspond to the implementation phase where multiple Trench agents ran in parallel on type safety, bundle size, and API response time fixes.

---

## 2. How AI Was Used — The Multi-Agent Workflow

This project used Claude Code not as a single conversational assistant, but as a team of specialized agents, each running in its own Claude Code session with a tailored system prompt:

| Agent Role | Purpose | Example Tasks |
|-----------|---------|---------------|
| Tower | Planning, architecture, work breakdown | Read assignment, design audit methodology, create beads (issues) with acceptance criteria, prioritize work |
| Trench | Implementation | Execute audit measurements, write code fixes, run tests, produce change docs with before/after proof |
| Herald | Writing, communications | Synthesize change docs into deliverables, draft presentations, tone/voice enforcement |

**Why this matters for cost analysis:** Each agent session carries full project context (CLAUDE.md, role prompts, codebase). The majority of token volume is cache reads of this shared context, not new reasoning. A single Trench session fixing type safety violations will re-read the same project context hundreds of times — but at the cache read rate ($1.50/M vs $15.00/M input), this overhead is 90% cheaper than it appears from raw token counts.

**Session concurrency:** Multiple Trench agents ran in parallel on separate git worktrees (e.g., one on type safety while another ran bundle analysis). This compressed calendar time but not total token cost — the work is the same whether serial or parallel.

---

## 3. Reflection Questions

### Which parts of the audit were AI tools most helpful for? Least helpful?

**Most helpful:**

- **Pattern-matching at scale.** The type safety audit required scanning 522 violations across hundreds of files, classifying each by root cause pattern (mock casts, DOM casts, API boundary casts, callback params), and ranking by severity. An agent with full codebase context does this in minutes where a human would spend hours with grep and a spreadsheet. The resulting taxonomy (F1-F9 in the audit) directly shaped which violations to fix and which to skip.

- **Mechanical refactoring with type-level reasoning.** The type safety fixes (F1-F5) required understanding TypeScript's type narrowing, discriminated unions, and generic inference to replace casts with proper types. Each fix was a judgment call — "is this cast hiding a real mismatch or is it safe?" — but there were 159 of them. The agent maintained consistency across all 159 while a human's attention would drift.

- **Benchmark automation.** The API response time audit involved seeding a database, authenticating with CSRF tokens, running `hey` at multiple concurrency levels, and parsing results. The agent wrote the reproduction scripts and ran the benchmarks end-to-end.

**Least helpful:**

- **Manual browser testing.** The runtime error handling audit (Category 6) required DevTools open, killing servers mid-edit, observing WebSocket reconnection behavior, and checking whether edits survived. The agent could analyze code statically and identify fire-and-forget patterns, but only a human with a browser could verify "does the data actually survive a disconnect?" The manual test checklist in `06-runtime-error-manual-tests.md` was human work.

- **Accessibility judgment calls.** axe-core and Lighthouse provided automated measurements, but deciding whether `#3b9bd6` is a good accessible accent blue vs `#2e8bc0` required visual judgment on a real screen. The agent proposed color values based on contrast ratio math; the human verified they looked right in context.

- **Architecture-level "should we do this" decisions.** The agent would happily implement anything. Deciding "skip pagination because the one-line content exclusion achieves the same P95 improvement" or "don't batch the test mock casts because 201 test-only changes look like cosmetic churn to a grader" — those were human calls about strategy, not execution.

### Did AI tools help you understand the codebase, or did they shortcut understanding?

Both, in different ways.

**Genuinely helped understanding:** The audit phase forced deep reading before any changes. Tower's role was explicitly "read and measure, don't fix." This produced structured diagnostics — the type safety audit's per-package breakdown, the API audit's endpoint selection methodology, the DB audit's query-per-flow counts — that built a real mental model of how the system works. The agent's ability to trace a request from `useIssuesQuery.ts` through the Express route to the SQL query and back, producing a coherent narrative, was genuine understanding-building.

**Shortcut risk was real but managed:** The danger with AI-assisted codebase auditing is that the agent reads the code *for* you and you just skim the summary. The multi-agent workflow mitigated this — Chair (human) reviewed every audit report, every change doc, and every before/after measurement. The "21 change docs with tradeoffs and deferred justifications" structure forced the agent to explain *why* each change was safe, which meant Chair had to evaluate those claims. When the agent said "this cast is safe because `PanelDocument` narrows correctly in switch cases," Chair verified that by reading `PropertiesPanel.tsx`.

The discovery that `web/tsconfig.json` was missing three strict flags that `api/` and `shared/` had — that came from the agent reading every tsconfig. A human might have caught it, but probably not on day one of orientation. The agent's thoroughness in reading *everything* was a genuine advantage over selective human attention.

### Where did you have to override or correct AI suggestions? Why?

- **Emoji picker regression.** During bundle size work (bead 2b4), the agent lazy-loaded the emoji picker successfully, but testing revealed that selecting an emoji returned a 400 error from the API. The agent's change doc correctly flagged this as a pre-existing bug (the `emoji` field was never in the API's Zod schema), but the human had to make the call: is this our regression or was it already broken? That required checking the original fork — something the agent couldn't do because it only had the current repo.

- **Type safety "any → as" migration.** The initial recount (bead tfn) showed 23.2%, short of the 25% target. The agent's F4 fix had replaced `any` with proper `as SomeType` casts — genuine safety improvements, but violations moved from one bucket to another without reducing the total. The human identified this and directed a targeted gap-close pass (bead 3ln) on the remaining low-hanging `any` instances in web/ to push past 25%.

- **Flaky test partial fix.** The agent fixed the typing-into-wrong-element bug in the retro stale-data test but couldn't fix the underlying Yjs persistence race (fire-and-forget `persistDocument` in the WebSocket close handler). The human made the call to document the race condition honestly rather than paper over it with longer timeouts.

- **Skipped findings triage.** For every category, the agent would have happily implemented all findings. The human made every "skip this" decision — auth caching is too complex for the gain, pagination requires frontend coordination, test mock casts look like cosmetic churn to a grader. These were strategic decisions about what demonstrates engineering judgment vs what looks like busywork.

### What percentage of your final code changes were AI-generated vs. hand-written?

**~95% AI-generated, ~5% human-directed corrections.**

All code was authored by Claude Code (Trench agent sessions). The human's role was:

1. **Task definition** — writing beads with acceptance criteria and constraints
2. **Review and approval** — reading diffs, verifying before/after measurements, approving merges
3. **Manual testing** — browser-based verification (runtime error scenarios, accessibility visual checks, WebSocket disconnect recovery)
4. **Strategic decisions** — which findings to fix vs skip, when to stop iterating, how to frame results for the grader

The 5% "hand-written" was primarily:

- Adjusting color values after visual inspection
- Editing commit messages
- Minor wording changes in change docs after review
- The manual test results in `06-runtime-error-manual-tests.md`

This high AI-generation percentage is possible because of the workflow design: detailed beads with clear acceptance criteria constrained the agent's output, and review gates caught issues before merge. The agent didn't have free rein — it executed well-scoped tasks with defined success criteria.

---

## 4. Key Takeaways

1. **Development tooling is the entire cost.** All AI spend on this project was development tooling (Claude Code sessions). No additional AI API costs were incurred for the audit and improvement work.

2. **Cache reads dominate token volume.** Each Claude Code session re-reads the full project context (CLAUDE.md, role prompts, source files) on every prompt. With Opus 4.6's cache read rate ($1.50/M vs $15.00/M input), this is 90% cheaper than the raw token count suggests.

3. **Multi-agent parallelism compresses time, not cost.** Running 3 Trench agents in parallel on separate worktrees cut calendar time roughly in half, but total tokens (and cost) are the same as serial execution. The value is speed, not savings.

4. **The audit phase was the best ROI.** Tower + Trench producing structured audit reports with severity rankings and improvement targets — before writing any fix code — made the implementation phase dramatically more efficient. Every fix had a clear target metric and a known root cause. This "measure first" approach is worth the token cost.

5. **Human judgment remains the bottleneck for quality.** The agent can fix 159 type safety violations, but deciding *which* violations to fix (and which to skip) requires understanding the system's real users — what matters to the team at Treasury, what changes carry regression risk for a production app, and where conservative restraint is more valuable than comprehensive coverage. The highest-value human contribution was triage, not code.
