# Splainer: Codebase Orientation

Walkthrough-level explanations of Treasury Ship's architecture, at a level suitable
for someone who programs but is new to this specific codebase.

---

## First Contact

### Repo Overview

This is a pnpm monorepo with three packages:

- **`api/`** — Express backend, direct PostgreSQL queries (no ORM), WebSocket server
  for real-time collab
- **`web/`** — React + Vite, TipTap rich-text editor with Yjs CRDTs, TanStack Query
  for data fetching
- **`shared/`** — TypeScript types and constants used by both sides

The architectural bet: everything in the app is a "document." Issues, projects,
sprints, wiki pages, people — they all live in one `documents` table. The
`document_type` column discriminates, and a `properties` JSONB column holds
type-specific metadata.

### Shared Types

The important file is `shared/src/types/document.ts`. The pattern:

- **`DocumentType` enum** is the discriminator — 10 values (wiki, issue, program,
  project, sprint, person, weekly_plan, weekly_retro, standup, weekly_review)
- Each type gets a **properties interface** (`IssueProperties`, `ProjectProperties`,
  etc.) — these map to what's in the `properties` JSONB column
- **Typed document variants** (`IssueDocument`, `WeekDocument`, etc.) narrow both
  `document_type` and `properties` at compile time

The other thing worth knowing: `ApiResponse<T>` is the standard envelope —
`{ success: boolean, data?: T, error?: ApiError }`. And session constants are
shared: 15-min inactivity, 12-hr absolute.

How the type system enforces the unified document model: discriminated unions. The
base `Document` interface has `properties: Record<string, unknown>`, but typed
variants narrow it. Zod schemas at API boundaries validate the runtime data.

### Data Model

**Relationships have two mechanisms** (a source of complexity):

- `parent_id` column — tree hierarchy, cascade delete (still used)
- `document_associations` junction table — for project/sprint/program relationships
  (replaced legacy `project_id`, `sprint_id`, `program_id` FK columns in migration 027)

So a document's "parent" is `parent_id`, but its "belongs to project X" is a row
in `document_associations`. The allowed relationship types in `document_associations`
are: **parent, project, sprint, program**.

### Complete Table Inventory

**Core content:**

- `documents` — the unified table (all content types)
- `document_associations` — relationships between documents (project, sprint, program, parent)
- `document_history` — field-level audit trail (who changed what, when)
- `document_snapshots` — state preservation before type conversions (issue → project)
- `document_links` — backlink/reference graph between documents
- `comments` — threaded comments on documents

**Identity & authorization:**

- `workspaces` — tenant table. Every document/membership/session scoped here.
  Notable: `sprint_start_date` is how week numbers are computed (not stored per sprint).
- `users` — global identity (email, password hash, PIV cert, super-admin flag)
- `workspace_memberships` — who can access which workspace (role: admin/member)
- `workspace_invites` — email/PIV invite flow
- `sessions` — session store (15-min inactivity + 12-hr absolute timeout)
- `oauth_state` — transient OAuth flow state

**Tracking & compliance:**

- `audit_logs` — action logging (actor, resource, IP, user agent)
- `sprint_iterations` — sprint/week progress snapshot entries
- `issue_iterations` — per-issue work iteration tracking

**Supporting:**

- `api_tokens` — token-based auth for CLI tools (hashed, with prefix)
- `files` — S3-backed uploads (s3_key, cdn_url, mime_type, size)
- `schema_migrations` — tracks which numbered migrations have been applied

That's **18 tables**. The unified document model keeps the core content in one table;
the rest is auth, relationships, audit, and infrastructure.

**Auth is separated from content.** `workspace_memberships` controls access
(admin/member role). `documents` where `document_type='person'` is the
profile/content representation. A user can be a workspace member without having a
person document — the `users` table is the source of identity (email, password hash,
PIV cert, super-admin flag), and `workspace_memberships` grants access. Person
documents are optional content artifacts for the team directory, capacity tracking,
and org chart. Think of it as: `users` + `workspace_memberships` = "can you log in
and access this workspace?" while person documents = "here's your profile page in
the app."

**Visibility model:** Documents are either `private` (creator + admins only) or
`workspace` (everyone in the workspace). This is checked inline in SQL, not
middleware.

Deleting a document with children: `parent_id` has `ON DELETE CASCADE`, so children
go too. The frontend has a `confirm_orphan_children` flag in the update schema that
warns before orphaning children when moving/re-parenting.

### Request Flow Trace

Tracing `GET /api/documents/:id` end to end — the most representative path.

**Client side:** The frontend calls `fetch('/api/documents/abc-123', { credentials:
'include' })`. In dev, Vite's proxy (`vite.config.ts`) forwards `/api/*` to
`localhost:3000`. In prod, CloudFront routes API requests to Elastic Beanstalk.

**Middleware stack** (order matters, defined in `app.ts`):

```
helmet          → security headers (CSP, HSTS, etc.)
cors            → checks Origin against CORS_ORIGIN env var
cookieParser    → parses cookies from request
express-session → loads/creates session from cookie, stores in PostgreSQL via pgSession
express.json    → parses body (10MB limit, relevant for creates/updates)
conditionalCsrf → if Bearer token: skip. If session cookie: require X-CSRF-TOKEN header
```

After all that, the request hits the route handler.

**Auth middleware** (`middleware/auth.ts`) runs per-route, not globally. It reads
`req.session`, checks the session is valid and not expired, and sets `req.userId`
and `req.workspaceId` on the request object. 401 if anything's wrong.

**The route handler** in `routes/documents.ts`:

1. Calls `canAccessDocument(id, userId, workspaceId)` — a single SQL query that
   fetches the document AND checks visibility in the same query (workspace-visible
   OR you created it OR you're an admin)
2. If accessible, returns `{ success: true, data: document }`
3. If not found or no access, returns 404

**The visibility check is SQL, not middleware.** The query itself bakes in the
access check with a boolean expression in the SELECT. Not a separate authorization
layer.

**Back to the client:** TanStack Query receives the response, caches it in memory,
persists to IndexedDB. On next visit, it serves the cached version instantly and
revalidates in the background (stale-while-revalidate).

**The real-time path is separate.** When you open a document for editing, the
browser also opens a WebSocket to `/collaboration/document:abc-123`. The collab
server loads `yjs_state` from the DB, syncs it to the client via the Yjs protocol,
and from then on all edits flow over WebSocket as CRDT updates — broadcast to
other connected editors and debounce-persisted back to the DB.

**Two parallel channels** for any document being edited: REST for metadata (title,
properties, associations) and WebSocket for content (the TipTap editor body).

---

## Deep Dive

### Real-Time Collaboration

The collab system lives in `api/src/collaboration/index.ts`. The stack:

- **Yjs** — CRDT library. Each document gets a `Y.Doc` in memory on the server.
- **y-protocols** — sync and awareness protocols over WebSocket.
- **TipTap** — rich text editor on the frontend, backed by Yjs for conflict-free
  multi-user editing.

**How it works:**

1. Browser connects to `ws://host/collaboration/{docType}:{docId}`
2. Server authenticates the WebSocket (validates session cookie inline — same
   15-min/12-hr timeout rules as REST)
3. Server loads `yjs_state` (binary) from the `documents` table into a `Y.Doc`
4. Yjs sync protocol runs: server sends its state, client sends its state, they merge
5. Awareness protocol starts: presence info (cursor position, user name) broadcasts
   to all connected clients
6. On each edit: client sends a Yjs update → server applies it to the in-memory
   `Y.Doc` → broadcasts to other clients → debounce-persists to DB (every 2 seconds)

**Rate limiting on WebSocket:** 30 connections/minute per IP, 50 messages/second
per connection. Progressive penalties — after 50 violations, the connection is closed.
This is DDoS protection for the collab server.

**Persistence path:** On each debounced save, the server also converts Yjs state
to TipTap JSON and stores it in the `content` JSONB column. This means the document
is readable via REST even without loading the Yjs binary. The server also extracts
structured text (plan/hypothesis, success criteria, vision, goals) from the content
for use in properties.

**Message types:** sync (0), awareness (1), custom event (2), clear cache (3).
Custom events are used for real-time notifications (e.g., "document was archived").
There's also a separate `/events` WebSocket for global notifications that persist
across navigation.

### TypeScript Patterns

**Zod at every API boundary.** Every route handler validates input with Zod's
`safeParse()`. Example from `routes/issues.ts`:

```typescript
const createIssueSchema = z.object({
  title: z.string().min(1).max(500),
  state: z.enum(['triage', 'backlog', 'todo', ...]).optional().default('backlog'),
  priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).optional().default('medium'),
  assignee_id: z.string().uuid().optional().nullable(),
  belongs_to: z.array(belongsToEntrySchema).optional().default([]),
});

// Usage:
const parsed = createIssueSchema.safeParse(req.body);
if (!parsed.success) {
  res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
  return;
}
```

**Discriminated unions** for document types — covered in First Contact. The key point:
base `Document` has `properties: Record<string, unknown>`, typed variants like
`IssueDocument` narrow to `properties: IssueProperties`. Compile-time safety,
runtime validation via Zod.

**`any` usage is minimal and intentional:**

- `z.any()` for TipTap JSON content (genuinely unstructured)
- `as any` in test mocks (standard vitest pattern)
- `doc: any` in `canAccessDocument()` return type (DB row, immediate property access)
- Zero `@ts-ignore` or `@ts-expect-error` in production code

**Error handling pattern** — consistent across all routes:

```typescript
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    // Specific checks first (400, 404, 403)
    // Then the happy path
  } catch (err) {
    console.error('[GET /endpoint]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

Frontend has a class-based `ErrorBoundary` component (`components/ui/ErrorBoundary.tsx`)
that catches render errors and shows a "Something went wrong" + "Try Again" button.

### Test Infrastructure

**Two layers: unit tests (Vitest) and E2E tests (Playwright).**

**Vitest** (`api/vitest.config.ts`):

- Runs with `fileParallelism: false` — test files run sequentially to avoid DB
  contention (all tests share one PostgreSQL instance)
- Tests within a file can still run in parallel
- Setup (`api/src/test/setup.ts`) TRUNCATEs all tables with CASCADE before tests
- Coverage via v8 provider

**Playwright** (`playwright.config.ts`):

- **Per-worker isolation** — each Playwright worker gets its own PostgreSQL container
  (via testcontainers), its own API server (dynamic port), and its own Vite preview
  server
- Worker count is calculated from available memory: `(freeMemGB - 2GB reserve) /
  0.5GB per worker`, capped at CPU core count
- Uses `vite preview` (static server, ~30-50MB) instead of `vite dev` (HMR, ~300-500MB)
  — a previous setup with 8 `vite dev` workers caused a 90GB memory explosion
- E2E fixtures in `e2e/fixtures/isolated-env.ts` extend Playwright's base test with
  worker-scoped database containers, retry logic for Docker port binding failures

**E2E test patterns:**

- Import `{ test, expect }` from `./fixtures/isolated-env` (not from `@playwright/test`)
- Login via page interaction (fill email/password, click sign in)
- Use `page.route()` to intercept API calls for error scenario testing
- Clear cookies in `beforeEach` for auth tests

### Build & Deploy

**Three environments:** dev, shadow (UAT), prod.

**Backend deploy** (`scripts/deploy.sh`):

1. Syncs Terraform config from AWS SSM (source of truth)
2. Builds shared + API packages
3. Verifies SQL files were copied to dist
4. Verifies migration file count matches (src vs dist)
5. **Tests Docker build locally** before pushing — catches import failures that
   would crash production
6. Verifies container can start and imports work (runs a quick `node -e` check)
7. Only then deploys to Elastic Beanstalk

**Frontend deploy** (`scripts/deploy-frontend.sh`):

1. Builds shared + web packages
2. Syncs to S3 with immutable cache headers (1 year for hashed assets)
3. Overwrites `index.html` with short cache (5 min) for SPA routing
4. Invalidates CloudFront

**Dockerfile:**

- Based on `node:20-slim`
- Installs pnpm, copies pre-built dist (not source), runs migrations on startup
  then starts API
- Disables SSL strict mode for government VPN environments
- CMD: `node dist/db/migrate.js && node dist/index.js`

**Local dev** (`scripts/dev.sh`):

- Derives DB name from worktree directory name (supports multi-worktree dev)
- Auto-creates database, runs migrations, seeds on first run
- Finds available ports (3000+, 5173+) to avoid conflicts between worktrees
- Starts API + Web in parallel

**Infrastructure** (Terraform):

- `terraform/` has modular config for Elastic Beanstalk, S3/CloudFront, IAM roles
- Per-environment configs in `terraform/environments/{env}/`
- Secrets managed via AWS SSM Parameter Store
