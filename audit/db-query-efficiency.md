# Audit: Database Query Efficiency

**Category:** Database Query Efficiency
**Bead:** treasury-ship-1ml
**Date:** 2026-03-10
**Status:** Audit complete — no code changes made

---

## Methodology

### Tools & Configuration

- **PostgreSQL 16** (Docker container, `treasury-ship-trench-b-postgres-1`)
- **Query logging:** `ALTER SYSTEM SET log_statement = 'all'` + `log_duration = 'on'`
- **Log capture:** `docker logs` with unique marker queries (`SELECT 'FLOW_START_...'`) to isolate per-flow queries
- **Query plans:** `EXPLAIN ANALYZE` via `docker exec ... psql`
- **API calls:** `curl` with session cookie authentication against Express API on port 3002
- **Dataset:** 257 documents (104 issues, 35 sprints, 15 projects, 11 users, 401 associations)

### Process

1. Enabled `log_statement=all` and `log_duration=on` on PostgreSQL
2. Started Express API server (non-watch mode for session stability)
3. Authenticated as dev user, captured session cookie
4. For each flow: inserted unique marker query → hit API endpoint → inserted end marker → parsed docker logs between markers
5. Counted all `execute <unnamed>:` statements per flow (excluding markers and auth overhead)
6. Ran `EXPLAIN ANALYZE` on the heaviest queries identified
7. Static analysis of route code for N+1 patterns and missing batch operations

---

## Baseline Measurements

### Read Path: 5 User Flows

| # | User Flow | Total Queries | Slowest Query | Response Time | Response Size | N+1 Detected? |
|---|-----------|--------------|---------------|---------------|---------------|----------------|
| 1 | Dashboard (my-work) | 7 | 2.125ms | 44ms | 6,895B | No |
| 2 | View document (wiki) | 4 | 0.606ms | 43ms | 897B | No |
| 3 | List issues | 5 | 1.608ms | 52ms | 102,132B | No |
| 4 | Load sprint board | 6 | 2.469ms | 53ms | 977B | No |
| 5 | Search (mentions) | 5 | 1.077ms | 50ms | 819B | No |

**Query breakdown per flow (excluding 2 auth overhead queries: session lookup + session update):**

- **Dashboard:** 5 app queries — workspace config, assigned issues (with JOINs), owned projects (with correlated subquery), active sprints
- **View document:** 2 app queries — document fetch, association lookup
- **List issues:** 3 app queries — workspace role check, main issue query, batch association lookup
- **Sprint board:** 4 app queries — workspace role check, sprint details + issues (with JOINs)
- **Search:** 3 app queries — workspace role check, mention search, document search

### Write Path: Create Issue (3 associations)

| Operation | Total Queries | N+1 Detected? |
|-----------|--------------|----------------|
| Create issue with 3 belongs_to (project, sprint, program) | 10 | **Yes** |

**Query breakdown:**

1. Session lookup (auth)
2. Session update (auth)
3. `pg_advisory_xact_lock` (ticket number serialization)
4. `SELECT MAX(ticket_number)` (next ticket number)
5. `INSERT INTO documents` (create the issue)
6. `INSERT INTO document_associations` (project) ← **N+1**
7. `INSERT INTO document_associations` (sprint) ← **N+1**
8. `INSERT INTO document_associations` (program) ← **N+1**
9. `SELECT COUNT(*) FROM document_associations` (accountability check per sprint)
10. `SELECT associations` (fetch back for response)

---

## Findings

### Finding 1: N+1 Association Inserts on Create/Update

**Severity: HIGH**
**Impact: Write path — every issue create/update**

Association inserts are executed in a loop — one INSERT per association instead of a single bulk INSERT.

**Locations:**

- `api/src/routes/issues.ts:627-634` (create)
- `api/src/routes/issues.ts:945-952` (update)
- `api/src/routes/documents.ts:544-551` (create)
- `api/src/routes/documents.ts:855-874` (update — delete loop + insert loop)

**Current:** 3 associations = 3 INSERT queries
**Optimal:** 1 bulk INSERT with VALUES clause: `INSERT INTO document_associations (...) VALUES (...), (...), (...)`

**Measured impact:** 3 extra queries per issue create. At scale (bulk import of 100 issues with 3 associations each), this is 300 queries instead of ~100.

### Finding 2: Bulk Move Issues — 3N Query Pattern

**Severity: HIGH**
**Impact: Sprint management — moving issues between sprints**

`api/src/routes/weeks.ts:2630-2653` executes 3 queries per issue in a loop:

```
for each issue_id:
  DELETE FROM document_associations (remove old sprint)
  INSERT INTO document_associations (add new sprint)
  UPDATE documents SET properties (update sprint reference)
```

**Measured impact:** Moving 50 issues = 150 queries. Should be 3 bulk queries.

### Finding 3: Sequential Table Scan on Documents

**Severity: MEDIUM**
**Impact: Every query filtering documents by workspace + type**

EXPLAIN ANALYZE shows `Seq Scan on documents` for the dashboard issues query:

```
Seq Scan on documents d  (cost=0.00..30.71 rows=1 width=258) (actual time=0.015..0.051 rows=12 loops=1)
  Filter: (workspace_id = '...' AND document_type = 'issue' AND ...)
  Rows Removed by Filter: 245
```

The `idx_documents_active` index exists on `(workspace_id, document_type) WHERE archived_at IS NULL AND deleted_at IS NULL` but the planner chose a seq scan at 257 rows. At scale (10K+ documents), this becomes a problem.

**Root cause:** With only 257 rows, PostgreSQL correctly prefers seq scan. But the index partial condition requires both `archived_at IS NULL AND deleted_at IS NULL`, so queries that don't include both conditions may not use it. The issues list query includes these conditions and should use the index at scale.

### Finding 4: Correlated Subquery for Project Status Inference

**Severity: MEDIUM**
**Impact: Dashboard and project list endpoints**

The "inferred_status" for projects uses a correlated subquery that JOINs 5 tables per project:

```sql
SELECT CASE MAX(...)
FROM documents issue
JOIN document_associations sprint_assoc ...
JOIN documents sprint ...
JOIN document_associations proj_assoc ...
JOIN workspaces w ...
WHERE proj_assoc.related_id = d.id
```

**Measured:** 0.186ms execution for 1 project. This is a per-row subquery — with 50 projects, it runs 50 times. Currently fast (0.067ms per execution due to Memoize), but scales linearly with project count.

### Finding 5: Auth Overhead on Every Request

**Severity: LOW**
**Impact: 2 queries per request (session lookup + session update)**

Every authenticated request executes:

1. `SELECT ... FROM sessions s JOIN users u WHERE s.id = $1` (session validation)
2. `UPDATE sessions SET last_activity = $1 WHERE id = $2` (sliding expiration)

**Measured:** ~0.2ms total. The UPDATE is throttled (only fires when enough time has passed), which is good. Sessions table is indexed on PK. This is acceptable overhead but notable — it's 29-50% of total query count per flow.

### Finding 6: Missing Compound Indexes for Common Query Patterns

**Severity: MEDIUM**
**Impact: Query performance at scale**

Common WHERE clause patterns not covered by compound indexes:

| Query Pattern | Used In | Current Index | Gap |
|---|---|---|---|
| `workspace_id + document_type + assignee_id` | Dashboard, issue lists | `idx_documents_active` (partial) | No assignee in index |
| `properties->>'assignee_id'` filtering | Dashboard, my-work | GIN on properties | GIN is broad, not optimal for single-key equality |
| `ticket_number + workspace_id` | Issue lookup by ticket # | None specific | Would benefit from compound index |
| `workspace_id + created_at DESC` | Pagination, activity feeds | `idx_documents_workspace_id` | No sort column |

### Finding 7: Batch Utilities Exist But Are Underused

**Severity: LOW (informational)**

`api/src/utils/document-crud.ts:148` provides `getBelongsToAssociationsBatch()` — a single-query batch lookup for associations. It's used by the issues LIST endpoint (good), but the CREATE and UPDATE paths don't use equivalent batch INSERT patterns.

---

## Index Coverage Assessment

### Well-Covered

- Document type filtering: `idx_documents_document_type` ✅
- Active documents: `idx_documents_active` (workspace_id, document_type WHERE not archived/deleted) ✅
- Association lookups: 5 indexes covering document_id, related_id, type, and compounds ✅
- JSONB properties: GIN index for broad property searches ✅
- Session lookup by PK: `sessions_pkey` ✅
- Person by user_id: `idx_documents_person_user_id` (expression index) ✅

### Gaps

- No expression index on `properties->>'assignee_id'` for issue assignment queries
- No compound index on `(workspace_id, updated_at DESC)` for sorted lists
- No index on `ticket_number` for issue-by-number lookups
- `document_associations` has no covering index for the full (document_id, relationship_type, related_id) tuple with related doc data

---

## EXPLAIN ANALYZE Results

### Dashboard Issues Query (2.125ms including prepare)

```
Sort  (cost=49.53..49.54 rows=1 width=318) (actual time=0.104..0.105 rows=12 loops=1)
  Sort Method: quicksort  Memory: 28kB
  ->  Nested Loop Left Join  (actual time=0.029..0.090 rows=12)
        ->  Nested Loop Left Join  (actual time=0.024..0.079 rows=12)
              ->  Nested Loop Left Join  (actual time=0.022..0.071 rows=12)
                    ->  Nested Loop Left Join  (actual time=0.019..0.063 rows=12)
                          ->  Seq Scan on documents d  (actual time=0.015..0.051 rows=12)
                                Filter: (workspace_id + document_type + assignee + state)
                                Rows Removed by Filter: 245
Planning Time: 0.828 ms
Execution Time: 0.148 ms
```

**Assessment:** 4 nested loop left joins. Seq scan filters out 95% of rows. At current scale (257 docs), this is fine. At 10K+ docs, the seq scan becomes the bottleneck. The `idx_documents_active` index could help but planner won't use it until the table is large enough.

### List Issues Query (1.608ms including prepare)

```
Sort  (cost=30.34..30.60 rows=104 width=308) (actual time=0.074..0.077 rows=104)
  Sort Method: quicksort  Memory: 58kB
  ->  Seq Scan on documents d  (actual time=0.005..0.050 rows=104)
        Filter: (deleted_at IS NULL AND archived_at IS NULL AND workspace_id AND document_type)
        Rows Removed by Filter: 153
Planning Time: 0.405 ms
Execution Time: 0.089 ms
```

**Assessment:** Returns 104 of 257 rows — 40% of table. Seq scan is optimal here. At scale, the `idx_documents_active` partial index on `(workspace_id, document_type)` should kick in.

### Project Status Inference (correlated subquery)

```
SubPlan 1  (actual time=0.067..0.068 rows=1 loops=1)
  ->  Aggregate
        ->  Nested Loop (actual time=0.044..0.060 rows=6)
              ->  Hash Join (sprint_assoc × proj_assoc)
                    Seq Scan on document_associations sprint_assoc (rows=108, removed=293)
```

**Assessment:** The subquery scans the full `document_associations` table for sprint relationships (108 of 401 rows). With a targeted index, this could be an index-only scan. At current scale: 0.067ms per project × 15 projects = ~1ms. At 100 projects with 10K associations: potentially 10-50ms.

---

## Improvement Targets

Based on the audit, the highest-impact improvements would be:

1. **Batch association inserts** (Finding 1) — Reduce create-issue queries from 10 to ~7 (30% reduction on write path)
2. **Batch bulk-move queries** (Finding 2) — Reduce from 3N to 3 queries (97% reduction for N=50)
3. **Add targeted indexes** (Finding 6) — Prevent seq scans at scale, especially `(workspace_id, document_type, updated_at)` compound

**Target from rubric:** 20% reduction in total query count on at least one user flow, or 50% improvement on the slowest query.

- Create issue: 10 → 7 queries = **30% reduction** (batch 3 association inserts into 1)
- Bulk move 50 issues: 150 → 3 queries = **98% reduction**
- Dashboard slowest query: add compound index → potential 50%+ improvement at scale

---

## Positive Patterns (Maintain)

- ✅ `getBelongsToAssociationsBatch()` used for list endpoints — single query for N document associations
- ✅ Parameterized queries throughout — no SQL injection risk
- ✅ GIN index on JSONB properties — enables flexible property queries
- ✅ Partial indexes for archived/deleted filtering
- ✅ Connection pool with statement timeout (30s) and max uses (7500)
- ✅ Transaction usage for multi-step mutations
- ✅ Dashboard and team grid use well-designed batch queries (no N+1)
- ✅ Session update throttling to avoid unnecessary writes
