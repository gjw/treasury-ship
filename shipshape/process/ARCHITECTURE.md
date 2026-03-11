# Ship — Architecture

## System Overview

Ship is a project-management tool (Jira/Trello-style) built by U.S. Department of the Treasury.
TypeScript monorepo: React frontend, Express backend, PostgreSQL database, real-time
collaboration via WebSocket + Yjs CRDTs.

## Stack

| Layer | Technology | Location |
|---|---|---|
| Frontend | React 18, Vite, TailwindCSS | `web/src/` |
| Editor | TipTap + Yjs (real-time collab) | `web/src/components/` (editor) |
| Backend | Express, Node.js | `api/src/` |
| Database | PostgreSQL (raw SQL via `pg`, no ORM) | `api/src/db/` |
| Real-time | WebSocket + Yjs | `api/src/collaboration/` |
| Shared Types | TypeScript | `shared/` |
| Testing | Playwright E2E (71 spec files), Vitest (unit) | `e2e/`, `api/src/__tests__/` |
| Infrastructure | Docker, Terraform, Elastic Beanstalk, S3/CloudFront | `Dockerfile*`, `terraform/` |
| Package Manager | pnpm workspaces | `pnpm-workspace.yaml` |

## Core Abstraction: Unified Document Model

**Everything is a document.** A single `documents` table with a `document_type` enum discriminator:
`wiki`, `issue`, `program`, `project`, `sprint`, `person`, `weekly_plan`, `weekly_retro`,
`standup`, `weekly_review`.

Type-specific data lives in a `properties JSONB` column. All document types share the same
TipTap JSON `content` column and `yjs_state` binary for collaboration.

### Key Tables

- **`documents`** — the unified table. 37 migrations evolved it.
- **`document_associations`** — junction table for relationships (parent, project, sprint, program).
- **`document_history`** — audit trail for field changes.
- **`document_snapshots`** — state preservation before type conversions.
- **`users`** / **`workspace_memberships`** — auth layer (PIV + password).
- **`sessions`** — 15-min inactivity timeout, 12-hr absolute.
- **`comments`** — inline threaded comments on documents.
- **`audit_logs`** — compliance-grade action logging.

### Relationships

Documents relate to each other via `document_associations` (replaced legacy FK columns).
Parent-child hierarchy via `parent_id` on documents table with circular-reference trigger guard.

## Data Flow

```
Browser → React (TipTap editor) → REST API (/api/*) → PostgreSQL
                                 ↘ WebSocket (/collaboration/*) → Yjs CRDT sync → PostgreSQL (yjs_state)
```

## 4-Panel Editor Layout

Every document editor: Icon Rail (48px) → Contextual Sidebar (224px) → Main Content (flex-1) → Properties Sidebar (256px).

## Key Directories

```
api/src/
  routes/         # REST endpoints
  middleware/      # Auth, session, etc.
  db/             # schema.sql, migrations/, seed
  collaboration/  # WebSocket + Yjs sync
  services/       # Business logic
  openapi/        # API spec generation

web/src/
  pages/          # Route-level components
  components/     # Shared + editor components
  hooks/          # React hooks
  contexts/       # React context providers
  services/       # API client layer

shared/
  types/          # TypeScript interfaces shared between packages

e2e/              # 71 Playwright spec files
scripts/          # Dev, deploy, utility scripts
terraform/        # AWS infrastructure
```

## Invariants

- Everything is a document — no new content tables.
- Server is truth — offline-tolerant but server-authoritative.
- "Untitled" for all new documents (not "Untitled Issue").
- Strict TypeScript (`strict: true`, `noUncheckedIndexedAccess: true` in root tsconfig).
- All schema changes via numbered migration files, never direct schema.sql edits.
