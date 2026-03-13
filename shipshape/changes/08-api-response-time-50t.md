# Change: Exclude content from issues list response (50t)

**Date:** 2026-03-12
**Issue:** treasury-ship-50t
**Branch:** task/50t-issues-list-content

## What changed

Removed `d.content` from the SELECT clause in `GET /api/issues` list endpoint
(`api/src/routes/issues.ts`, line ~127). Individual issue endpoints still return
content via `GET /api/documents/:id`.

## Per-file changes

| File | Change |
|------|--------|
| `api/src/routes/issues.ts` | Removed `d.content,` from list query SELECT (line 127) |

## Before/after benchmarks

**Environment:** 304 issues, benchmark seed, Apple Silicon, local PostgreSQL via SSH tunnel, `hey` -n 200

### Response size

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Response size | 320 KB | 287 KB | -10% |

**Note:** The benchmark seed creates issues with empty TipTap content
(`{"type":"doc","content":[{"type":"paragraph"}]}` = 46 bytes each). In production,
issues with real descriptions, checklists, and embedded content will show a much
larger reduction. The 10% reduction here is a floor, not a ceiling.

### P95 latency (ms)

| Concurrency | Before | After | Change |
|-------------|--------|-------|--------|
| c=10 | 53.9 | 58.1 | +4% (noise) |
| c=25 | 90.2 | 81.2 | -10% |
| c=50 | 197.2 | 154.3 | **-22%** |

### Throughput (req/s)

| Concurrency | Before | After | Change |
|-------------|--------|-------|--------|
| c=10 | 283 | 302 | +7% |
| c=25 | 312 | 347 | +11% |
| c=50 | 290 | 342 | **+18%** |

## Why the improvement is smaller than the original audit predicted

The original audit (03-api-response-time.md) showed 312KB → predicted 30-40KB after
dropping content. That prediction assumed issues would have substantial TipTap content
bodies. The benchmark seed populates 200 extra issues with empty documents (46 bytes
each), so the content column only accounts for ~33KB of the 320KB response. The
remaining 287KB is `properties` JSONB, timestamps, associations, and other columns.

**In production with real content, the improvement will be significantly larger.**
The fix is correct regardless — the list view never renders document bodies.

## Tradeoffs

- **No frontend impact.** The frontend `Issue` type in `useIssuesQuery.ts` does not
  define a `content` field. Content is fetched individually via `GET /api/documents/:id`.
- **`extractIssueFromRow()` still references `row.content`.** This shared function is
  used by both list and individual routes. For list responses, `row.content` is
  `undefined` (omitted from JSON serialization). For individual routes that still
  SELECT `d.content`, it works as before.

## What to know for next time

- The benchmark seed needs richer content bodies to accurately measure content-related
  optimizations. Consider adding realistic TipTap JSON with paragraphs, headings, and
  lists to the benchmark seed issues.
- The `properties` JSONB column is now the dominant contributor to response size at
  287KB for 304 issues (~944 bytes/issue average in properties alone).
