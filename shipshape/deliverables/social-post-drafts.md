# Social Post Drafts — LinkedIn

---

## Option E — matches LegacyLens post tone

Week 4 of Gauntlet for America, and the first full week in Austin. The assignment was different this time: instead of building something from scratch, inherit a production codebase you've never seen, measure its health across seven categories, and make it measurably better — without changing any functionality.

The codebase was Ship, a project management app built for the US Department of the Treasury. TypeScript monorepo, React frontend, Express backend, PostgreSQL, real-time collaboration via Yjs CRDTs. 73+ Playwright E2E tests, Docker and Terraform deployment configs, a unified document model where everything — issues, wikis, projects, sprints — lives in a single table.

What made this one interesting was the constraint. No stack changes, no new dependencies, no behavioral changes. Just diagnosis and targeted fixes. Some of what we found:

The issues list API returned full document bodies for every issue — 312 KB of TipTap JSON the frontend never rendered. One line removed, 23% faster. A bulk sprint move ran 152 individual queries in a loop. Batched it to 5. The collaboration server persisted documents without error handling — if the DB write failed on disconnect, user edits were silently lost.

The biggest shift from previous weeks: this project was about reading, not writing. The hardest part wasn't implementing fixes — it was understanding an unfamiliar system deeply enough to know which fixes mattered and which ones weren't worth the risk.

Measure first, fix second, prove everything.

---

## Option F — shorter, punchier

First week in Austin for Gauntlet for America. This time the assignment wasn't "build something" — it was "inherit something and make it better."

Ship is a project management app built for the US Department of the Treasury. I had to audit it across seven categories and deliver measurable improvements in six days, without changing any functionality.

Some findings: an API endpoint returning 312 KB of data the frontend never used. A collaboration server that silently lost user edits on database failure. 152 queries in a loop that should have been 5. A two-megabyte JavaScript bundle loaded on every page.

What made it hard wasn't the fixes — most were small. It was reading an unfamiliar codebase deeply enough to find the right things to fix, and having the discipline to skip the things that weren't worth the risk.

Every improvement has before/after measurements. No new dependencies. No behavioral changes.

Reading code carefully is a different kind of hard than writing it from scratch. Both matter.
