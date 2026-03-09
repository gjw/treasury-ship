# Orientation: First Contact (treasury-ship-uhe)

Repo overview, shared types, data model, request flow trace.

## Repo Overview

Treasury Ship is a **government project-management SaaS** (Jira/Trello-style) with
real-time collaborative editing. Built as a TypeScript monorepo with pnpm workspaces.

### Monorepo Structure

```
treasury-ship/
├── api/          Express backend, PostgreSQL, WebSocket collaboration
├── web/          React + Vite frontend, TipTap editor
├── shared/       TypeScript types shared between api and web
├── e2e/          Playwright E2E tests (~71 specs)
├── scripts/      Dev, deploy, utility scripts
├── terraform/    AWS infrastructure (EB, S3/CloudFront)
├── docs/         Architectural documentation
├── .beads/       Issue tracking (beads_rust)
└── .claude/      Claude Code config & skills
```

**Key entry points:**

- `api/src/index.ts` → server bootstrap (Express + WebSocket)
- `api/src/app.ts` → middleware stack, route registration
- `web/src/main.tsx` → React root with TanStack Query + persistence
- `web/src/pages/App.tsx` → 4-panel layout, routing, context providers
- `shared/src/index.ts` → type/constant barrel export

## Shared Types

All shared types live in `shared/src/types/`. The key file is `document.ts`.

### Document Type System

The core discriminator is `DocumentType`:

```
wiki | issue | program | project | sprint | person |
weekly_plan | weekly_retro | standup | weekly_review
```

Each type has a **typed properties interface** (`IssueProperties`, `ProjectProperties`,
`WeekProperties`, etc.) stored in the `properties` JSONB column.

**Typed document variants** provide compile-time safety: `IssueDocument`,
`ProjectDocument`, `WeekDocument`, etc. — each narrowing `document_type` and
`properties` to their specific types.

### Key Enums

- `IssueState`: triage → backlog → todo → in_progress → in_review → done / cancelled
- `IssuePriority`: low | medium | high | urgent
- `WeekStatus`: active | upcoming | completed
- `DocumentVisibility`: private | workspace
- `BelongsToType`: program | project | sprint | parent

### Other Shared Types

- `User` — id, email, name, isSuperAdmin, lastWorkspaceId
- `ApiResponse<T>` — `{ success, data?, error? }` envelope
- `ApiError` — `{ code, message, details? }`
- Constants: `HTTP_STATUS`, `ERROR_CODES`, `SESSION_TIMEOUT_MS` (15 min),
  `ABSOLUTE_SESSION_TIMEOUT_MS` (12 hr)

## Unified Document Model (Data Model)

**Core design decision:** Everything is a document. One `documents` table, discriminated
by `document_type`. No separate tables for issues, projects, etc.

### `documents` table (key columns)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `workspace_id` | UUID FK | Tenant isolation |
| `document_type` | ENUM | Discriminator |
| `title` | TEXT | Display name ("Untitled" default) |
| `content` | JSONB | TipTap editor JSON |
| `yjs_state` | BYTEA | Yjs CRDT binary state |
| `parent_id` | UUID FK (self) | Tree hierarchy (cascade delete) |
| `position` | INTEGER | Sort order within parent |
| `properties` | JSONB | Type-specific metadata |
| `ticket_number` | INTEGER | Auto-increment per workspace |
| `visibility` | TEXT | 'private' or 'workspace' |
| `archived_at` | TIMESTAMPTZ | Soft archive |
| `deleted_at` | TIMESTAMPTZ | Soft delete (30-day retention) |

Status timestamps: `started_at`, `completed_at`, `cancelled_at`, `reopened_at`
Conversion tracking: `converted_to_id`, `converted_from_id`, `converted_at`

### Relationships

**`document_associations`** — junction table replacing legacy FK columns:

- `document_id` → `associated_document_id` with `relationship_type`
- Types: parent, project, sprint, program
- Unique constraint prevents duplicates

**`parent_id`** column still exists for tree hierarchy (cascade delete).

### Supporting Tables

- `users` — global identity (email, password hash, PIV cert)
- `workspace_memberships` — authorization (role: admin/member)
- `sessions` — 15-min inactivity + 12-hr absolute timeout
- `comments` — threaded document comments
- `files` — S3-backed uploads
- `document_history` — field-level audit trail
- `document_snapshots` — state preservation before type conversion
- `document_links` — backlink/reference graph
- `audit_logs` — compliance logging

Schema evolves via numbered migrations in `api/src/db/migrations/` (37 total).
Never edit `schema.sql` directly for existing tables.

## Request Flow Trace

### Example: `GET /api/documents/:id`

**1. Client → Vite proxy → Express**

Frontend `fetch('/api/documents/abc-123', { credentials: 'include' })` hits Vite's
dev proxy, which forwards to `localhost:3000`.

**2. Express middleware stack** (in `app.ts`):

```
helmet (security headers)
  → cors (CORS_ORIGIN)
    → cookieParser
      → express-session (15-min timeout, pgSession store)
        → express.json (10MB limit)
          → conditionalCsrf (skip for Bearer, enforce for session)
            → route handler
```

**3. Auth middleware** (`middleware/auth.ts`):

Validates session cookie → sets `req.userId` and `req.workspaceId`.
Returns 401 if no valid session.

**4. Route handler** (`routes/documents.ts`):

```typescript
router.get('/:id', authMiddleware, async (req, res) => {
  // 1. canAccessDocument() — SQL check: visibility='workspace' OR created_by=user OR user is admin
  // 2. Query document with belongs_to associations (LEFT JOIN document_associations)
  // 3. Return { success: true, data: document }
});
```

**5. Visibility check** — inline SQL in `canAccessDocument()`:

- Workspace-visible docs: everyone sees them
- Private docs: only creator or workspace admins
- Admins bypass visibility restrictions

**6. Response** → `ApiResponse<Document>` envelope back to client.

### Example: Real-time collaboration flow

```
Browser                    WebSocket Server              PostgreSQL
  │                              │                           │
  ├─ connect /collaboration/     │                           │
  │   document:abc-123           │                           │
  │                              ├─ load yjs_state ─────────►│
  │                              │◄──── binary state ────────┤
  │◄──── sync step 1 ───────────┤                           │
  ├──── sync step 2 ────────────►│                           │
  │◄──── awareness ──────────────┤                           │
  │                              │                           │
  ├──── update (keystroke) ──────►│                           │
  │                              ├─ broadcast to peers       │
  │                              ├─ debounced persist ──────►│
  │◄──── peer updates ──────────┤                           │
```

The collaboration server (`api/src/collaboration/index.ts`) uses Yjs CRDT protocol.
Binary state persists to `documents.yjs_state`. TipTap on the frontend renders
the Yjs doc and provides the editing UI.

### Example: `POST /api/documents` (create)

```
1. Zod validation (createDocumentSchema)
2. authMiddleware → userId, workspaceId
3. INSERT INTO documents (id=uuid, workspace_id, document_type, title, properties, ...)
4. If belongs_to provided → INSERT INTO document_associations
5. Return { success: true, data: newDocument }
```

### Frontend data flow

```
Route navigation
  → useDocumentsQuery (TanStack Query, stale-while-revalidate)
    → fetch /api/documents?type=...
      → Cache in memory + IndexedDB persistence
        → Render in component tree
          → Edit via TipTap → auto-save + Yjs sync
```

TanStack Query persists to IndexedDB via `PersistQueryClientProvider`, giving
near-instant loads on revisit with background revalidation.

## Key Observations

1. **Single table, single editor** — the unified model is well-executed. Properties
   JSONB keeps type-specific data flexible without schema migrations per type.

2. **Zod at boundaries** — API routes validate input with Zod schemas. Shared types
   provide compile-time safety. The pattern is consistent.

3. **Auth is session-based** with CSRF tokens, plus Bearer token support for CLI.
   PIV/FPKI auth exists for government compliance.

4. **37 migrations** — significant schema evolution. The associations refactor
   (removing direct FK columns) was a major change.

5. **Real-time via Yjs** — CRDT-based, not OT. Binary state stored in DB, synced
   over WebSocket. All document types share the same collaboration path.
