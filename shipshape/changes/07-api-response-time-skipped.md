# Change Doc: API Response Time — Skipped Findings

**Category:** 3 — API Response Time
**Status:** Acknowledged, not pursued

## Relationship to Assignment (GFA Week 4)

The PDF assignment asks for **"20% reduction in P95 response time on at least 2 endpoints."** We're targeting F1 (issues content payload) and F3 (projects correlated subqueries) as the two fix beads — both deliver well over 20% reduction on their respective endpoints. The findings below were evaluated and deliberately skipped.

## F2: Auth Middleware Runs 3 DB Queries Per Request (MEDIUM)

**What it is:** Every authenticated request executes three round-trips to Postgres before the route handler starts: session lookup (JOIN users), workspace membership check, and `last_activity` UPDATE. The `last_activity` write happens on every request despite a 60-second cookie refresh throttle.

**Why skipped:** The overhead is ~2-5ms per request — real but small compared to the F1 and F3 improvements (80%+ and ~40% P95 reductions respectively). The proper fix (in-memory session cache with TTL, throttled DB writes) introduces a process-level cache that needs invalidation logic, TTL tuning, and careful handling of multi-process deployments. Complexity is disproportionate to the gain, and the 20% target is already met by F1 + F3 alone.

**If revisited:** Cache the session lookup result in a `Map<sessionId, {user, workspace, expiry}>` with a 60-second TTL matching the existing cookie refresh threshold. Throttle `last_activity` UPDATEs to the same interval. This would eliminate 2 of 3 queries on most requests.

## F4: No Pagination on Any List Endpoint (MEDIUM)

**What it is:** All five benchmarked endpoints (issues, documents/:id, projects, weeks, programs) return their full dataset with no `limit`/`offset`. At current volume (622 documents, 304 issues) this is manageable, but latency degrades linearly with data growth.

**Why skipped:** This is a structural change requiring frontend coordination — every list view would need pagination controls, infinite scroll, or virtualization. The current data volume doesn't cause problems (the issues endpoint's slowness is payload size, not row count — the SQL query runs in 0.4ms). The 20% target is met without this. Pagination is the right long-term fix for the issues endpoint, but content exclusion (F1) delivers the same P95 improvement with a one-line change.

**If revisited:** Start with cursor-based pagination on GET /api/issues (keyset pagination on `created_at, id`). Add `?limit=50&cursor=` parameters. Frontend would need a fetch-more trigger in the issues list. Other endpoints are fast enough that pagination can wait until data volume grows 5-10x.

## F5: Rate Limiter Blocks Concurrent Testing (LOW)

**What it is:** The production rate limiter (100 req/min, 1000 in dev) triggers during load testing. A single user with 5 tabs auto-refreshing 4 endpoints every 5 minutes generates 20 req/5min — well within limits. But any automated tooling or moderate concurrency exceeds it.

**Why skipped:** This is working as designed. The rate limiter exists for security (DoS protection on a government app). The `E2E_TEST=1` bypass exists for testing. No production users are affected at current usage levels.

**No action needed.** Document the `E2E_TEST=1` bypass in benchmarking reproduction steps.

## F6: Connection Pool Has Headroom (INFO)

**What it is:** Even at c=50, the single-document endpoint handles 2,788 RPS. The Postgres connection pool and Express event loop are not the bottleneck — payload size and query complexity are.

**Why noted:** This is a positive finding. It confirms that F1 and F3 are the correct targets — the infrastructure can handle the load, so the fixes should translate directly to user-visible improvement without infrastructure changes.

**No action needed.** This finding supports the decision to focus on application-level optimizations rather than infrastructure tuning.
