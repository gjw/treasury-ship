# Change Doc: DB Query Efficiency — Skipped Findings

**Category:** 4 — Database Query Efficiency
**Status:** Acknowledged, not pursued

## Relationship to Assignment (GFA Week 4)

The PDF assignment asks for **"20% reduction in total query count on at least one user flow, or 50% improvement on the slowest query."** We're targeting F1 (batch association inserts, 30% reduction on create-issue) and F2 (batch bulk-move, 98% reduction). The findings below were evaluated and deliberately skipped.

## F3: Sequential Table Scan on Documents (MEDIUM)

**What it is:** EXPLAIN ANALYZE shows `Seq Scan on documents` for queries filtering by `workspace_id + document_type`. The `idx_documents_active` partial index exists but the planner chose seq scan.

**Why skipped:** With 257 rows, PostgreSQL is correct to prefer seq scan — the entire table fits in a few pages. The index exists and will activate at scale (10K+ rows). Forcing index usage at current volume would actually be slower. There's no query count reduction here, and no measurable improvement at current data volume.

**If revisited:** At 10K+ documents, verify `idx_documents_active` is being used. If not, consider `SET enable_seqscan = off` in a test session to confirm the index path is faster, then investigate why the planner isn't choosing it (stale statistics, partial index conditions not matching).

## F4: Correlated Subquery for Project Status Inference (MEDIUM)

**What it is:** The "inferred_status" for projects uses a correlated subquery joining 5 tables per project row. Currently 0.067ms per execution with Memoize.

**Why skipped:** Already fixed in Category 3 (bead 2zn) as part of the projects query CTE optimization. The correlated subquery was replaced with a CTE. No additional work needed.

## F5: Auth Overhead — 2 Queries Per Request (LOW)

**What it is:** Every authenticated request runs a session lookup JOIN and a session `last_activity` UPDATE. This is 2 of the 7-10 queries per flow (29-50% of query count).

**Why skipped:** Total overhead is ~0.2ms. The session UPDATE is already throttled. Eliminating these would require in-memory session caching, which introduces cache invalidation complexity disproportionate to the gain. The assignment target (20% reduction on a user flow) is met by F1 alone (30% on create-issue). Auth caching would also overlap with the Category 3 skipped finding (F2 in that category).

**If revisited:** Same approach as Category 3's skipped F2 — in-memory Map with TTL, throttled writes.

## F6: Missing Compound Indexes (MEDIUM)

**What it is:** Common WHERE patterns lack targeted compound indexes: `(workspace_id, document_type, assignee_id)`, `(ticket_number, workspace_id)`, `(workspace_id, updated_at DESC)`.

**Why skipped:** At 257 rows, adding indexes produces no measurable improvement — the planner will still seq scan. The before/after EXPLAIN ANALYZE would show identical plans. We can't prove the improvement the assignment requires. These indexes are the right long-term investment but don't deliver measurable results at current data volume.

**If revisited:** Add indexes when data volume reaches 5K+ rows. Start with `CREATE INDEX idx_documents_workspace_type_updated ON documents (workspace_id, document_type, updated_at DESC) WHERE deleted_at IS NULL` — this covers the most common list query pattern.

## F7: Batch Utilities Exist But Are Underused (LOW/Informational)

**What it is:** `getBelongsToAssociationsBatch()` in `document-crud.ts` provides single-query batch reads for associations. The read path uses it; the write path doesn't have an equivalent.

**Why noted:** This is the positive pattern that F1 extends to the write side. F1's fix (bulk INSERT for associations) is essentially the write-side equivalent of this existing read-side batch utility. No separate action needed — F1 addresses this directly.
