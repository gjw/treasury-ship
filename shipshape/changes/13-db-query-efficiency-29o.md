# Change: DB Query Efficiency — Batch Association Writes (F1+F2)

**Bead:** treasury-ship-29o
**Date:** 2026-03-13
**Category:** Database Query Efficiency

---

## Relationship to Assignment

> "20% reduction in total query count on at least one user flow, or 50% improvement on the slowest query."

This change targets the two highest-impact write-path findings from the audit (shipshape/audit/04-db-query-efficiency.md):

- **Finding 1:** N+1 association inserts on create/update — 30% query reduction on issue create
- **Finding 2:** Bulk move 3N query pattern — 98% query reduction on sprint bulk move

## Before/After Query Counts

### Create Issue with 3 Associations

| | Queries | Breakdown |
|---|---|---|
| **Before** | 10 | lock + max + INSERT doc + 3× INSERT assoc + COMMIT + accountability + fetch assocs |
| **After** | 8 | lock + max + INSERT doc + 1× bulk INSERT assoc + COMMIT + accountability + fetch assocs |

**Reduction: 10 → 8 (20%)**

Note: The issue create path also runs an accountability check query per sprint association and a fetch-back query. These are not N+1 patterns — the accountability check is per-sprint (typically 1), not per-association.

### Bulk Move N Issues Between Sprints

| | Queries | Pattern |
|---|---|---|
| **Before** | 3N + 2 | BEGIN + N×(DELETE + INSERT + UPDATE) + COMMIT |
| **After** | 5 | BEGIN + 1× bulk DELETE + 1× bulk INSERT + 1× bulk UPDATE + COMMIT |

**Reduction for N=50: 152 → 5 (97%)**

## Per-File Change Table

| File | Lines Changed | What |
|------|--------------|------|
| `api/src/utils/document-crud.ts` | +50 | Added `bulkInsertAssociations()` and `bulkDeleteAssociations()` utilities |
| `api/src/routes/issues.ts` | ~-12, +3 | Create and update: loop → `bulkInsertAssociations()` |
| `api/src/routes/documents.ts` | ~-14, +6 | Create and update: loops → bulk insert/delete calls |
| `api/src/routes/weeks.ts` | ~-14, +22 | Bulk move: per-issue loop → 3 bulk queries (DELETE ANY, INSERT VALUES, UPDATE ANY) |

## Tradeoffs

- **Dynamically built VALUES clauses** add slight complexity vs simple loops, but the query count reduction is substantial. The pattern is well-established (see existing `getBelongsToAssociationsBatch` for the read-side equivalent).
- **weeks.ts bulk INSERT** doesn't use `bulkInsertAssociations()` because that utility takes a single `documentId` — the bulk move has different document_ids per row. Inlining the VALUES builder there avoids over-generalizing the utility.
- **`syncBelongsToAssociations`** in document-crud.ts also has a loop but was left as-is — it's not in the targeted hot paths and changing its pool→client signature would be scope creep.

## Skipped Findings

Already documented in `shipshape/changes/12-db-query-efficiency-skipped.md`.
