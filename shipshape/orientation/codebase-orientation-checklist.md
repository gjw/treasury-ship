# Codebase Orientation Checklist

Completed 2026-03-09. Notes from initial orientation of Treasury Ship codebase.

---

## Phase 1: First Contact

### 1. Repository Overview

**Clone and run locally:**

Cloned, ran into several undocumented steps:

- pnpm is assumed globally installed. Had to install it and use `npx pnpm` throughout.
- `npx pnpm install` from root didn't fully install api dependencies. Had to also
  run `npx pnpm install` from within `api/`.
- Post-install warns that `comply` CLI (Python: `pip install comply-cli`) is needed
  for pre-commit hooks — not mentioned in setup docs.
- pnpm warns about ignored build scripts (esbuild, leveldown, ssh2, etc.) and says
  to run `pnpm approve-builds`. Not documented.
- `docker-compose.yml` has an obsolete `version: '3.8'` attribute that triggers a
  deprecation warning.
- Node v20 is used. Supported but EOLs ~April 2026. Should cycle to v22 or v24.

After those steps, `npx pnpm dev` successfully starts both servers (API on :3000,
web on :5173). The dev script auto-creates a local PostgreSQL database, runs
migrations, and seeds data.

**docs/ folder — key architectural decisions:**

The docs folder has ~15 documents. The most important:

- `unified-document-model.md` — Everything is a document. One `documents` table,
  discriminated by `document_type`, type-specific data in `properties` JSONB.
  Follows Notion's paradigm. This is the defining architectural bet.
- `application-architecture.md` — Design principles: maximally simple, boring
  technology, single codebase, server is source of truth. Tech stack is Express +
  React + Vite + PostgreSQL (raw SQL, no ORM) + TipTap/Yjs for collaborative editing.
- `document-model-conventions.md` — Terminology rules, 4-panel editor layout
  (icon rail | sidebar | content | properties), "Untitled" as default title for
  all doc types.
- `ship-philosophy.md` — Work hierarchy: Programs → Projects → Weeks → Issues. Programs
  are long-lived initiatives, projects are time-bounded experiments with ICE scoring,
  weeks are accountability windows, issues are work units.
- `accountability-philosophy.md` — Performance management: weekly plans, standups,
  retrospectives, approval workflows.

**shared/ package types:**

The `shared/` package exports TypeScript types and constants used by both frontend
and backend. Key contents:

- `DocumentType` enum — 10 values: wiki, issue, program, project, sprint, person,
  weekly_plan, weekly_retro, standup, weekly_review
- Per-type properties interfaces — `IssueProperties` (state, priority, assignee),
  `ProjectProperties` (ICE scores, RACI), `WeekProperties` (sprint number, plan,
  approvals), etc.
- Typed document variants — `IssueDocument`, `ProjectDocument`, `WeekDocument`, etc.
  These narrow `document_type` and `properties` at compile time via discriminated unions.
- `ApiResponse<T>` — standard response envelope: `{ success: boolean, data?: T, error?: ApiError }`
- Session constants — `SESSION_TIMEOUT_MS` (15 min), `ABSOLUTE_SESSION_TIMEOUT_MS` (12 hr)
- HTTP status and error code constants

**Package relationship diagram:**

```
┌──────────────────────────────────────────────────────────────┐
│                        shared/                               │
│  Types, constants, enums (DocumentType, ApiResponse, etc.)   │
└──────────────────┬───────────────────────┬───────────────────┘
                   │ imported as           │ imported as
                   │ @ship/shared          │ ../shared (ref)
                   ▼                       ▼
┌─────────────────────────────┐  ┌─────────────────────────────┐
│           api/              │  │           web/               │
│  Express + PostgreSQL       │  │  React + Vite + TipTap      │
│  WebSocket collab server    │  │  TanStack Query (cache)     │
│  REST endpoints (/api/*)    │  │  Yjs client (CRDT sync)     │
└──────────────┬──────────────┘  └──────────────┬──────────────┘
               │                                │
               │  REST: /api/* (fetch)          │
               │◄───────────────────────────────┤
               │                                │
               │  WebSocket: /collaboration/*   │
               │◄──────────────────────────────►│
               │  (Yjs sync + awareness)        │
```

In dev, Vite proxies `/api/*` and `/collaboration/*` to the API server. In prod,
CloudFront routes API traffic to Elastic Beanstalk and serves the web bundle from S3.

### 2. Data Model

**Tables and relationships:**

18 tables total. The core content table is `documents`; everything else is auth,
relationships, audit, or infrastructure.

Core content:

- `documents` — unified table for all content types
- `document_associations` — relationships between documents (types: parent, project, sprint, program)
- `document_history` — field-level audit trail
- `document_snapshots` — state preservation before type conversions
- `document_links` — backlink/reference graph
- `comments` — threaded document comments

Identity and authorization:

- `workspaces` — tenant table, scopes everything. Has `sprint_start_date` for week number calculation.
- `users` — global identity (email, password hash, PIV cert)
- `workspace_memberships` — who can access which workspace (role: admin/member)
- `workspace_invites` — invite flow
- `sessions` — session store with timeout enforcement
- `oauth_state` — transient OAuth state

Tracking and compliance:

- `audit_logs` — action logging
- `sprint_iterations` / `issue_iterations` — progress tracking

Supporting:

- `api_tokens` — CLI token auth
- `files` — S3-backed uploads
- `schema_migrations` — migration tracking

**Unified document model:**

One `documents` table serves all content types. The `document_type` column is an enum
that discriminates: wiki, issue, program, project, sprint, person, etc. Type-specific
data goes in the `properties` JSONB column (e.g., an issue has `state`, `priority`,
`assignee_id`; a project has `impact`, `confidence`, `ease` ICE scores).

The shared TipTap content goes in the `content` JSONB column, and Yjs binary state
goes in `yjs_state` (BYTEA). Every document type uses the same editor and the same
collaboration infrastructure.

**document_type discriminator in queries:**

Routes filter by type: `WHERE document_type = 'issue' AND workspace_id = $1`. The
issues route, projects route, etc. are just specialized views over the same table
with type-specific business logic (state transitions for issues, ICE scoring for
projects, plan/retro workflows for weeks).

**Document relationships:**

Two mechanisms coexist:

- `parent_id` column (self-referencing FK, cascade delete) — tree hierarchy within
  a document type (e.g., wiki pages nested under wiki pages)
- `document_associations` junction table — cross-type relationships. An issue
  "belongs to" a project and a sprint via rows in this table. Relationship types:
  parent, project, sprint, program.

The associations table replaced legacy direct FK columns (`project_id`, `sprint_id`,
`program_id`) that were dropped in migration 027.

### 3. Request Flow

**Traced: creating an issue**

Frontend: User clicks "New Issue" → `IssuesList.tsx` calls
`fetch('/api/issues', { method: 'POST', body: { title, state, priority, ... } })`.

Middleware chain (in order, from `app.ts`):

1. `helmet` — security headers (CSP, HSTS, X-Frame-Options)
2. `cors` — validates Origin against `CORS_ORIGIN` env var
3. `cookieParser` — parses cookies
4. `express-session` — loads/creates session from cookie, backed by PostgreSQL store
5. `express.json` — parses request body (10MB limit)
6. `conditionalCsrf` — enforces X-CSRF-TOKEN header for session auth; skips for Bearer tokens

Then the route handler:

1. `authMiddleware` — validates session, sets `req.userId` and `req.workspaceId`. Returns 401 if invalid.
2. Zod validation — `createIssueSchema.safeParse(req.body)`. Returns 400 with details on failure.
3. Database INSERT — `INSERT INTO documents` with `document_type = 'issue'`, properties merged from validated input.
4. If `belongs_to` provided — INSERT rows into `document_associations`.
5. Response — `{ success: true, data: newIssue }` with 201 status.

**Authentication flow:**

Session-based with cookies. `POST /api/auth/login` validates email/password (or
PIV certificate), creates a session row in the `sessions` table, sets a session
cookie. The session has 15-minute inactivity timeout and 12-hour absolute timeout.
Every authenticated request refreshes `last_activity`. Unauthenticated requests get
a 401 from `authMiddleware` — no redirect, the frontend handles routing to `/login`.

There's also Bearer token auth for CLI tools (via `api_tokens` table), which
bypasses CSRF but goes through the same auth middleware.

---

## Phase 2: Deep Dive

### 4. Real-time Collaboration

**WebSocket establishment:**

Browser connects to `ws://host/collaboration/{docType}:{docId}`. The server
(`api/src/collaboration/index.ts`) validates the session cookie from the upgrade
request — same 15-min/12-hr rules as REST. Connection is rate-limited: 30
connections/minute per IP.

**Yjs sync between users:**

Yjs uses a CRDT (Conflict-free Replicated Data Type) model. On connect, the server
loads the document's `yjs_state` binary from PostgreSQL into an in-memory `Y.Doc`.
The Yjs sync protocol runs: server sends its state vector, client sends its state
vector, they exchange missing updates. After sync, both have identical state.

**Concurrent editing:**

When two users edit simultaneously, each generates a Yjs update that's sent to the
server. The server applies it to the in-memory `Y.Doc` (CRDTs merge deterministically
— no conflicts possible) and broadcasts the update to all other connected clients.
Awareness protocol separately syncs cursor positions, selection, and user presence.

**Persistence:**

On each edit, the server schedules a debounced save (2-second delay). The save
encodes the Yjs state to binary (`yjs_state` column) and also converts it to
TipTap JSON (`content` column). This dual-write means REST reads work without
understanding CRDTs. The server also extracts structured text (plan, success
criteria, etc.) from content for use in properties.

Message rate limit: 50 messages/second per connection. After 50 rate-limit
violations, connection is closed (DDoS protection).

### 5. TypeScript Patterns

**Version and config:**

TypeScript 5.9.3. Strict mode is on everywhere.

Root `tsconfig.json` settings: `strict: true`, `noUncheckedIndexedAccess: true`,
`noImplicitReturns: true`, `noFallthroughCasesInSwitch: true`. Target ES2022.

The web package extends root config with `jsx: react-jsx`, `moduleResolution: bundler`,
and path alias `@/*` → `./src/*`. The api package extends root with `module: NodeNext`
and references shared via path alias `@ship/shared`.

**Shared types between frontend and backend:**

The `shared/` package is a project reference for the web package and a path alias for
the api package. Both import from `@ship/shared`. Types are defined once, used in
both Zod validation (api) and component props/hooks (web).

**Pattern examples in the codebase:**

Generics: `ApiResponse<T>` — `interface ApiResponse<T = unknown> { success: boolean; data?: T; error?: ApiError }`. Used throughout the frontend API layer to type responses.

Discriminated unions: The document type system. `IssueDocument` narrows
`document_type: 'issue'` and `properties: IssueProperties`. The base `Document`
has `properties: Record<string, unknown>`.

Utility types: `Partial<ProjectProperties>` used for default property values
(`DEFAULT_PROJECT_PROPERTIES`). `Record<string, unknown>` for the base properties
type.

Type guards: `isValidIconName(name: string): name is IconName` in
`web/src/components/icons/uswds/types.ts`. Also
`isWeeklyDocumentAccountabilityType` in `web/src/lib/accountability.ts` for
narrowing document types in accountability workflows.

**No unfamiliar patterns.** The codebase uses standard TypeScript idioms — nothing
exotic. Zero `@ts-ignore` in production code. `any` is used sparingly: `z.any()`
for TipTap JSON content (genuinely unstructured), `as any` in test mocks.

### 6. Testing Infrastructure

**Playwright structure:**

~71 E2E test specs in `e2e/`. Tests import from `e2e/fixtures/isolated-env.ts`,
which extends Playwright's base test with worker-scoped fixtures. Each worker gets
its own PostgreSQL container (via testcontainers), its own API server on a dynamic
port, and its own Vite preview server. Full isolation — no shared state between
workers.

Worker count is calculated from available memory:
`(freeMemGB - 2GB reserve) / 0.5GB per worker`, capped at CPU cores. Uses
`vite preview` instead of `vite dev` (~30-50MB vs ~300-500MB per worker) after a
previous 90GB memory explosion with 8 dev workers.

**Test database setup/teardown:**

Unit tests (Vitest): `api/src/test/setup.ts` runs `TRUNCATE TABLE ... CASCADE` on
all tables before the suite. Tests share one PostgreSQL instance, so file-level
parallelism is disabled (`fileParallelism: false`) to prevent contention.

E2E tests: each Playwright worker spins up a fresh PostgreSQL container with its own
seed data. No teardown needed — containers are disposable.

**Test suite run:**

Unit tests (`pnpm test`): 28 files, 451 tests, all passing, 11.5 seconds. The
stderr output from auth and activity tests is intentional — those tests verify
error handling by deliberately triggering DB failures. "CAIA not configured" is
expected in local dev (PIV auth not set up).

E2E tests (`pnpm test:e2e`): In progress. The testcontainers setup requires
Docker/Colima configuration not documented in the repo — needed `DOCKER_HOST`,
`TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE`, and `~/.testcontainers.properties` to get
testcontainers to detect the container runtime. After resolving that, tests are
running but hitting various failures (mount errors, fixture issues). Getting the
full E2E suite green on a fresh machine is a non-trivial onboarding task — this is
itself a finding worth addressing. Stabilizing the local E2E setup is in progress
and not blocking this initial evaluation.

### 7. Build and Deploy

**Dockerfile:**

Based on `node:20-slim`. Installs pnpm, copies pre-built dist files (not source),
and on startup runs `node dist/db/migrate.js && node dist/index.js`. Disables SSL
strict mode for government VPN environments. Production dependencies only
(`--prod` flag).

**docker-compose.yml:**

Single service: PostgreSQL 16. Optional — most developers use native PostgreSQL.
Provides `ship_dev` database with dev-only credentials. Has a health check
(`pg_isready`). The `version: '3.8'` attribute is obsolete and triggers a warning.

**Terraform infrastructure:**

Modular configs in `terraform/` with per-environment directories
(`environments/dev`, `environments/shadow`, `environments/prod`). Provisions:

- Elastic Beanstalk for the API (Docker-based)
- S3 + CloudFront for the frontend
- IAM roles for EB instances
- Secrets via AWS SSM Parameter Store

**CI/CD:**

No `.github/workflows/` directory — no automated CI/CD pipeline configured.
Deployment is manual via scripts: `scripts/deploy.sh prod` (backend → EB) and
`scripts/deploy-frontend.sh prod` (frontend → S3/CloudFront). The deploy script
is defensive: builds locally, tests Docker image boots, verifies migration counts,
then pushes.

---

## Phase 3: Synthesis

### 8. Architecture Assessment

**3 strongest decisions:**

1. *Unified document model.* One table, one editor, one collaboration path for all
   content types. No schema migrations to add a new type — just a new enum value and
   properties interface. The team committed fully; there are no rogue content tables.

2. *CRDTs for real-time collaboration.* Yjs CRDTs converge mathematically without a
   central arbiter. The server is just relay + persistence. The dual-write (Yjs binary
   + TipTap JSON on every save) means REST reads never need to understand CRDTs.

3. *Defensive deploy pipeline.* Builds Docker locally, tests that it starts, verifies
   migration file counts, only then pushes to AWS. Catches "it builds but doesn't boot"
   failures before they reach production.

**3 weakest points:**

1. *In-memory Y.Doc storage with no ceiling.* The collab server holds Yjs documents
   in a JavaScript Map with no eviction policy or memory limit. A 30-second grace
   period on disconnect is the only cleanup. No circuit breaker if memory grows.

2. *Visibility checks in SQL, not middleware.* Access control is a boolean expression
   inside each route's SQL query. Every new route must remember to include the
   filter — a missed filter means a data leak. Some routes use a
   `VISIBILITY_FILTER_SQL` helper, some inline it.

3. *No CI/CD pipeline.* Deploys are manual script runs. No automated test gates,
   no PR checks, no deploy-on-merge. The deploy scripts are solid but depend on a
   human remembering to run them correctly.

**Onboarding — what to tell a new engineer first:**

Everything is a document. That's the mental model. Issues, projects, sprints, wiki
pages — they're all rows in the same table with different `document_type` values.
The shared TipTap editor handles all of them. Type-specific behavior comes from
`properties` JSONB and the route handlers that know how to work with each type.
Start by reading `docs/unified-document-model.md`, then trace a request from the
React component through the API route to the SQL query.

**What breaks at 10x users:**

1. Collab server memory — in-memory Y.Doc map is the first bottleneck. Needs Redis-backed
   storage or horizontal scaling with sticky sessions.
2. Single PostgreSQL — no read replicas, no external connection pooling. Heavy read
   load with inline visibility checks hits the DB on every request.
3. WebSocket and REST share one process — a burst of collab connections can degrade
   API response times. These should be separate services at scale.
