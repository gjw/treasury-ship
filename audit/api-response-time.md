# Audit: API Response Time (treasury-ship-81l)

**Date:** 2026-03-09
**Branch:** trench-B
**Auditor:** Trench agent

## Test Environment

- **Hardware:** Apple Silicon (local dev)
- **Database:** PostgreSQL 16 (Docker, port 5433)
- **Server:** Express + Node.js (single process, E2E_TEST=1 for rate limit bypass)
- **Tool:** `hey` v0.1.5 (200 requests per endpoint per concurrency level)

## Data Volume

Seeded with benchmark data exceeding the target thresholds:

| Entity | Count | Target |
|--------|-------|--------|
| Total documents | 622 | 500+ |
| Issues | 304 | 100+ |
| Wiki documents | 157 | — |
| Users | 26 | 20+ |
| Sprints | 35 | 10+ |
| Projects | 15 | — |
| Programs | 5 | — |

Standard `pnpm db:seed` produced 257 documents. A supplemental benchmark seed
(`scripts/benchmark-seed.sql`) added 200 issues, 150 wiki docs, and 15 users.

## Endpoint Selection Methodology

Traced every `useQuery` / `fetch` call in `web/src/` to identify which API
endpoints fire during real user flows. The top 5 by frequency:

1. **GET /api/issues** — fires on app cold start, issues list view (5min refetch)
2. **GET /api/documents/:id** — fires on every document navigation
3. **GET /api/projects** — fires on app cold start, dashboard (5min refetch)
4. **GET /api/weeks** — fires on dashboard load (5min refetch)
5. **GET /api/programs** — fires on app cold start, sidebar nav (5min refetch)

Endpoints 1, 3, 4, 5 all fire in parallel on every app load. Endpoint 2 fires
on every navigation click.

## Results

### Concurrency = 10

| Endpoint | P50 | P95 | P99 | RPS | Response Size |
|----------|-----|-----|-----|-----|---------------|
| GET /api/issues | 37.7ms | 68.8ms | 101.8ms | 249 | 312 KB |
| GET /api/documents/:id | 3.8ms | 5.9ms | 7.4ms | 2,510 | 1.4 KB |
| GET /api/projects | 9.5ms | 21.5ms | 28.3ms | 909 | 13.3 KB |
| GET /api/weeks | 8.2ms | 13.5ms | 14.7ms | 1,134 | 4.2 KB |
| GET /api/programs | 6.4ms | 10.9ms | 12.6ms | 1,401 | 1.6 KB |

### Concurrency = 25

| Endpoint | P50 | P95 | P99 | RPS |
|----------|-----|-----|-----|-----|
| GET /api/issues | 81.4ms | 96.6ms | 109.0ms | 299 |
| GET /api/documents/:id | 8.5ms | 13.1ms | 15.1ms | 2,759 |
| GET /api/projects | 23.3ms | 30.5ms | 36.4ms | 1,018 |
| GET /api/weeks | 20.7ms | 27.6ms | 29.4ms | 1,155 |
| GET /api/programs | 16.7ms | 24.1ms | 28.7ms | 1,388 |

### Concurrency = 50

| Endpoint | P50 | P95 | P99 | RPS |
|----------|-----|-----|-----|-----|
| GET /api/issues | 161.1ms | 176.8ms | 189.3ms | 301 |
| GET /api/documents/:id | 17.0ms | 22.9ms | 25.2ms | 2,788 |
| GET /api/projects | 44.4ms | 52.9ms | 61.3ms | 1,062 |
| GET /api/weeks | 39.9ms | 48.8ms | 52.4ms | 1,171 |
| GET /api/programs | 33.1ms | 40.7ms | 42.5ms | 1,434 |

## Findings

### Finding 1: GET /api/issues is 10x slower than other endpoints (SEVERITY: HIGH)

**P95 at c=50: 177ms** — the slowest endpoint by a wide margin.

**Root cause: 312KB response payload.** The endpoint returns the full `content`
column (TipTap JSON document body) for all 304 issues in a single unpaginated
response. The SQL query itself is only **0.4ms** (confirmed via `EXPLAIN ANALYZE`),
so the bottleneck is JSON serialization and network transfer of 312KB per request.

**Evidence:**

- Response size is 222x larger than the single-document endpoint (312KB vs 1.4KB)
- RPS tops out at ~300 regardless of concurrency (saturating serialization)
- P50 scales linearly with concurrency: 38ms → 81ms → 161ms (queuing)

**Opportunities:**

- Exclude `content` from list responses (only needed when opening a single issue)
- Add pagination (frontend already fetches all — would need coordination)
- Could cut response to ~30-40KB (10x reduction) by dropping content

### Finding 2: Auth middleware issues 3 DB queries per request (SEVERITY: MEDIUM)

Every authenticated request runs:

1. `SELECT ... FROM sessions JOIN users` — session lookup
2. `SELECT id FROM workspace_memberships` — workspace access check
3. `UPDATE sessions SET last_activity` — touch timestamp

That's 3 round-trips to Postgres before the route handler even starts. The
`last_activity` update is particularly wasteful — it already has a 60-second
throttle for cookie refresh but still updates the DB row on every request.

**Opportunity:** Cache session data in-memory (process-level Map with TTL),
throttle `last_activity` updates to match the cookie refresh threshold.

### Finding 3: GET /api/projects uses correlated subqueries (SEVERITY: MEDIUM)

**P95 at c=50: 53ms**

The projects query runs 3 correlated subqueries per project row:

1. `SELECT COUNT(*)` for sprint count
2. `SELECT COUNT(*)` for issue count
3. Complex `inferredStatusSubquery` with date arithmetic and JSONB array length

With 15 projects, that's 45 subqueries. This scales linearly with project count.

**Opportunity:** Replace correlated subqueries with CTEs or lateral joins.

### Finding 4: No pagination on any list endpoint (SEVERITY: MEDIUM)

All 5 benchmarked endpoints return their full dataset with no `limit`/`offset`.
At current volume (622 docs) this is manageable, but latency will degrade
linearly as data grows. Issues endpoint is already showing the strain at 304 rows.

### Finding 5: Rate limiter blocks legitimate concurrent usage (SEVERITY: LOW)

In the first benchmark run (dev mode, NODE_ENV unset), the rate limiter
(1000 req/min) allowed only the issues endpoint to complete before blocking
all subsequent endpoints with 429. A single user with 5 browser tabs open,
each auto-refreshing 4 endpoints every 5 minutes, generates 20 req/5min —
manageable. But any automated tooling or moderate concurrency hits the limit.

**Note:** This is by design for production (100 req/min). No action needed,
but worth documenting for future load testing.

### Finding 6: Connection pool not saturated (SEVERITY: INFO)

Even at c=50, the single-document endpoint handles 2,788 RPS. This tells us
the Postgres connection pool and Express event loop have headroom. The
bottleneck is payload size and query complexity, not infrastructure.

## Severity Ranking

| # | Finding | Severity | Impact on P95 |
|---|---------|----------|---------------|
| 1 | Issues endpoint returns full content (312KB) | HIGH | 177ms at c=50 |
| 2 | Auth middleware 3 DB queries/request | MEDIUM | ~2-5ms per request |
| 3 | Projects correlated subqueries | MEDIUM | 53ms at c=50 |
| 4 | No pagination on list endpoints | MEDIUM | Linear degradation with data growth |
| 5 | Rate limiter blocks concurrent testing | LOW | Operational concern only |
| 6 | Connection pool has headroom | INFO | Positive finding |

## Improvement Targets

**20% P95 reduction on at least 2 endpoints** (per audit spec):

1. **GET /api/issues** — Dropping `content` from list response should reduce
   P95 from 177ms to ~20-30ms (80%+ reduction). This is the single highest-ROI
   change.
2. **GET /api/projects** — Replacing correlated subqueries with CTEs should
   reduce P95 from 53ms to ~25-30ms (~40% reduction).

Both changes are localized to their route handlers and don't require frontend
changes (the frontend already fetches individual documents separately for
content display).

## Reproduction

```bash
# 1. Start postgres
docker compose -f docker-compose.local.yml up -d postgres

# 2. Create .env.local
echo 'DATABASE_URL=postgres://ship:ship_dev_password@localhost:5433/ship_dev' > api/.env.local

# 3. Migrate + seed + benchmark seed
pnpm db:migrate && pnpm db:seed
docker exec -i treasury-ship-trench-b-postgres-1 psql -U ship -d ship_dev < scripts/benchmark-seed.sql

# 4. Start server (with rate limit bypass for benchmarking)
E2E_TEST=1 pnpm dev:api

# 5. Authenticate
curl -s -c /tmp/bench_cookies.txt http://localhost:3000/api/csrf-token > /tmp/csrf.json
CSRF=$(python3 -c "import json; print(json.load(open('/tmp/csrf.json'))['token'])")
curl -s -b /tmp/bench_cookies.txt -c /tmp/bench_cookies.txt \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d '{"email":"dev@ship.local","password":"admin123"}' \
  http://localhost:3000/api/auth/login

# 6. Benchmark (example)
SESSION=$(grep session_id /tmp/bench_cookies.txt | awk '{print $NF}')
hey -n 200 -c 50 -H "Cookie: session_id=$SESSION" http://localhost:3000/api/issues
```
