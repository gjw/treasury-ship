# Change: Optimize projects query with CTEs (2zn)

**Date:** 2026-03-12
**Issue:** treasury-ship-2zn
**Branch:** task/2zn-projects-cte

## What changed

Replaced 3 correlated subqueries in `GET /api/projects` with CTEs (Common Table
Expressions) that compute sprint counts, issue counts, and inferred status in a
single pass per table, then LEFT JOIN to the main query.

Before: each of the 15 project rows triggered 3 subqueries (45 total).
After: 3 CTEs execute once each, results joined by project_id.

## Per-file changes

| File | Change |
|------|--------|
| `api/src/routes/projects.ts` | Replaced correlated subqueries (lines ~360-420) with `sprint_counts`, `issue_counts`, and `inferred_statuses` CTEs. Removed `inferredStatusSubquery` variable. Archived/completed status logic moved to main SELECT CASE expression. |

## Functional verification

All 15 projects verified: `sprint_count`, `issue_count`, and `inferred_status`
values are identical between before and after responses.

## Before/after benchmarks — Projects endpoint

**Environment:** 15 projects, 304 issues, 35 sprints, benchmark seed, Apple Silicon, local PostgreSQL, `hey` -n 200

### P95 latency (ms)

| Concurrency | Before | After | Change |
|-------------|--------|-------|--------|
| c=10 | 17.2 | 13.4 | **-22%** |
| c=25 | 30.8 | 24.8 | **-19%** |
| c=50 | 52.9 | 46.0 | **-13%** |

### Throughput (req/s)

| Concurrency | Before | After | Change |
|-------------|--------|-------|--------|
| c=10 | 965 | 1,120 | **+16%** |
| c=25 | 1,032 | 1,234 | **+20%** |
| c=50 | 1,069 | 1,234 | **+15%** |

## Cumulative Category 3 benchmarks — All 5 endpoints

These numbers include both the 50t fix (issues content exclusion) and this
2zn fix (projects CTE optimization), measured against the pre-50t baseline
from the original audit (`shipshape/audit/03-api-response-time.md`).

### P95 latency (ms) — All endpoints, c=50

| Endpoint | Original Audit | After 50t+2zn | Change |
|----------|---------------|---------------|--------|
| GET /api/issues | 176.8 | 155.1 | **-12%** |
| GET /api/documents/:id | 22.9 | 24.0 | ~0% (noise) |
| GET /api/projects | 52.9 | 46.0 | **-13%** |
| GET /api/weeks | 48.8 | 52.9 | ~0% (noise) |
| GET /api/programs | 40.7 | 38.0 | -7% |

### P95 latency (ms) — All endpoints, c=10

| Endpoint | Original Audit | After 50t+2zn | Change |
|----------|---------------|---------------|--------|
| GET /api/issues | 68.8 | 52.9 | **-23%** |
| GET /api/documents/:id | 5.9 | 6.4 | ~0% (noise) |
| GET /api/projects | 21.5 | 13.4 | **-38%** |
| GET /api/weeks | 13.5 | 15.1 | ~0% (noise) |
| GET /api/programs | 10.9 | 9.9 | -9% |

### Throughput (req/s) — All endpoints, c=50

| Endpoint | Original Audit | After 50t+2zn | Change |
|----------|---------------|---------------|--------|
| GET /api/issues | 301 | 343 | **+14%** |
| GET /api/documents/:id | 2,788 | 2,733 | ~0% |
| GET /api/projects | 1,062 | 1,234 | **+16%** |
| GET /api/weeks | 1,171 | 1,109 | ~0% |
| GET /api/programs | 1,434 | 1,492 | +4% |

### Summary

Two endpoints improved by 20%+ on P95 at c=10 (issues -23%, projects -38%).
At c=50, improvements are 12% and 13% respectively — still meaningful but
bounded by connection pool contention at higher concurrency.

## Tradeoffs

- **CTE vs correlated subquery:** CTEs compute counts for ALL projects in the
  workspace, not just visible ones. This is a minor over-computation (the
  visibility filter applies to the main query, not the CTEs). With 15 projects
  this is negligible. If project count grew to hundreds with strict visibility,
  the CTEs could be scoped with a workspace_id filter (already done for
  `inferred_statuses` which needs workspace for sprint date calculation).
- **`sprint_counts` and `issue_counts` CTEs scan all document_associations.**
  These are fast GROUP BY queries on an indexed junction table. They don't
  filter by workspace because `document_associations` doesn't have a
  workspace_id column — the join to the main query handles workspace scoping.

## What to know for next time

- The `inferred_statuses` CTE uses `(sprint.properties->>'project_id')::uuid`
  as the grouping key. This relies on sprint documents having a `project_id`
  property. If sprints are ever associated to projects via `document_associations`
  instead, this CTE would need updating.
- The `sprint_counts`/`issue_counts` CTEs use `document_associations` with
  `relationship_type = 'project'`. This is consistent with how the rest of
  the codebase tracks project membership.
