# Discovery Write-up

Ship is a production TypeScript monorepo with a React frontend, Express backend, PostgreSQL database, and real-time collaboration via Yjs CRDTs. Auditing and improving it across 7 categories over one week surfaced architectural patterns, testing infrastructure, and editor design decisions that were new to me. These are the three most significant — each changed how I think about a class of engineering problem.

---

## 1. Unified Document Model — Single-Table Polymorphism with JSONB Properties

### Where

- `api/src/db/schema.sql:98-162` — `document_type` enum (10 values) and `documents` table
- `shared/src/types/document.ts:34-317` — TypeScript discriminated union with per-type property interfaces
- `api/src/db/schema.sql:199-222` — `document_associations` junction table replacing legacy foreign key columns
- `api/src/db/schema.sql:367` — partial index `idx_documents_active`

### What it does and why it matters

Ship stores all 10 content types — issues, wikis, projects, sprints, programs, people, plans, retros, standups, and reviews — in a single `documents` table. A `document_type` enum discriminates between them. Type-specific data lives in a `properties` JSONB column, while shared structure (title, content, yjs_state, timestamps, visibility, ownership) is in typed columns.

Relationships between documents use a `document_associations` junction table with four relationship types (`parent`, `project`, `sprint`, `program`) and a uniqueness constraint preventing duplicate associations. This replaced legacy `project_id`/`sprint_id`/`program_id` foreign key columns (removed in migrations 027 and 029).

The architectural payoff is significant:

- **Adding a new document type requires no schema migration** — just a new enum value and a TypeScript interface for its properties.
- **Every document type gets real-time collaboration for free** because the `content` (TipTap JSON) and `yjs_state` (Yjs CRDT binary) columns are shared across all types.
- **The partial index** `idx_documents_active ON (workspace_id, document_type) WHERE archived_at IS NULL AND deleted_at IS NULL` optimizes the most common query pattern without indexing archived data.

The TypeScript side mirrors this with discriminated unions — `IssueDocument`, `ProjectDocument`, `SprintDocument`, etc. — each constraining `document_type` to a literal and `properties` to a typed interface. We engaged with this directly during the type safety work: the `PropertiesPanel` component narrows on `document_type` in a switch statement, and we added an exhaustive `never` check in the default case to catch missing variants at compile time.

The tradeoff is real: you can't use relational foreign key constraints on type-specific fields (they live in JSONB), so those invariants are enforced in application code. And queries that need to count "issues in this project" require subqueries filtering on `document_type` through the junction table — which is why our Category 3 CTE optimization mattered.

### How I would apply this in a future project

This pattern is compelling for any application where multiple content types share structural bones (content, ownership, timestamps, access control) but differ in metadata. The combination of JSONB properties and TypeScript discriminated unions gives you per-type type safety at the application layer while keeping a single table at the database layer. I'd reach for it in a CMS, knowledge base, or project management tool — anywhere "everything is a document" is a natural fit.

The key lesson is that the junction table for relationships is essential. Direct foreign key columns (`project_id`, `sprint_id`) don't scale — when a document can belong to multiple containers or the relationship types expand, you need the flexibility of a junction table. Ship learned this the hard way and migrated.

---

## 2. Testcontainers for Per-Worker Database Isolation in E2E Tests

### Where

- `e2e/fixtures/isolated-env.ts:108-149` — per-worker PostgreSQL container fixture
- `e2e/fixtures/isolated-env.ts:203-265` — Vite preview server (with comment documenting 90GB memory explosion from `vite dev`)
- `playwright.config.ts:37-48` — dynamic worker count calculation based on available memory and CPU cores
- `e2e/fixtures/isolated-env.ts:37-50` — deterministic port allocation scheme

### What it does and why it matters

Each Playwright worker gets its own complete, isolated stack: a PostgreSQL Docker container, an Express API server, and a Vite preview server. The worker count is dynamically calculated as `min(available_memory / 500MB, CPU_cores)` in local dev, fixed at 4 in CI. Port allocation uses a deterministic scheme — base 10000, 100 ports per worker, `workerIndex % 555` — to avoid collisions without coordination.

The isolation is total: no shared database state, no test ordering dependencies, no flaky failures from concurrent mutations. Each container gets a fresh schema load and seed data. The worker-scoped fixture lifecycle guarantees cleanup via try-finally, even if tests crash.

The critical architectural lesson lives in a comment at `isolated-env.ts:9-12`: running 8 `vite dev` servers caused a **90GB memory explosion** and crashed the system. Each `vite dev` instance runs HMR, file watchers, and Vite's dependency pre-bundling — the comment estimates 300-500MB per instance, but the 90GB total suggests these processes interact badly under parallel load (likely filesystem watcher contention or Vite's prebundle cache thrashing across 8 simultaneous instances). The fix was switching to `vite preview`, a lightweight static file server at ~30-50MB per instance. Each worker now costs ~500MB total (Postgres ~150MB, API ~100MB, preview ~30MB, browser ~200MB) — a manageable 2GB for 4 workers instead of a runaway explosion.

The approach works but is objectively heavyweight. Each worker spins up an entire PostgreSQL server process in its own Docker container. PostgreSQL supports `CREATE DATABASE ... TEMPLATE baseline_db`, which clones a seeded database in subseconds via copy-on-write at the filesystem level. A single shared Postgres instance with per-worker template databases would achieve the same isolation guarantees at a fraction of the memory cost — one 150MB Postgres process instead of four. The testcontainers approach trades ~450MB of RAM for implementation simplicity: no template setup, no shared-instance coordination, no cleanup logic between test runs. Whether that tradeoff is worth it depends on CI runner resources and test suite size.

### How I would apply this in a future project

The testcontainers pattern is a strong default for E2E test isolation — it eliminates an entire class of shared-state flakiness with minimal setup code. But for larger suites or resource-constrained CI, I'd combine it with PostgreSQL's template database feature: one testcontainer running a shared Postgres instance, with per-worker databases cloned from a pre-seeded template. This gives you the isolation of separate databases with the resource efficiency of a single server process.

The `vite dev` vs `vite preview` lesson is broadly applicable: dev-mode servers are designed for single-instance interactive use. Any time you're running N parallel instances of a dev tool, check whether it has a lightweight production/preview mode. The difference can be 10x memory per instance.

---

## 3. TipTap Extension Architecture — Structured Content Models with Custom Node Types

### Where

- `web/src/components/editor/DetailsExtension.ts:36-216` — collapsible details block with `detailsSummary` and `detailsContent` child nodes
- `web/src/components/editor/DetailsComponent.tsx:12-60` — React NodeView for interactive toggle UI
- `web/src/components/Editor.tsx:556-630` — extension composition array
- `web/src/components/editor/CommentMark.ts:22-119` — Mark extension for inline comment highlights

### What it does and why it matters

TipTap's extension system is built on three primitives — `Node`, `Mark`, and `Extension` — each created via a factory function that defines a schema, commands, keyboard shortcuts, and optionally a React component for rendering.

The `DetailsExtension` is the clearest example of the pattern's power. It defines a collapsible toggle block with **strict child node ordering** via a content model string:

```
content: 'detailsSummary detailsContent'
```

This single declaration means a details block must contain exactly one `detailsSummary` (inline content only, `content: 'inline*'`) followed by exactly one `detailsContent` (block content, `content: 'block+'`). ProseMirror enforces this structure at the schema level — you can't accidentally nest blocks in the summary or delete one of the children. The editor self-heals if the structure is violated (e.g., during paste).

The `DetailsComponent.tsx` React NodeView decouples presentation from schema. It renders a clickable triangle toggle that updates the `open` attribute via `updateAttributes({ open: !node.attrs.open })`. The content is rendered by TipTap's `NodeViewContent`, which automatically maps the two child nodes into the React tree. This separation means you can completely change the toggle UI without touching the schema or serialization.

Ship uses this pattern throughout: `HypothesisBlockExtension` (sprint hypothesis statements with `content: 'inline*'`), `PlanReferenceBlock` (non-editable plan items with `atom: true`), `DocumentEmbed` (cross-document references), `FileAttachment` (download links with upload progress). Each defines its schema constraints declaratively and its UI imperatively via React.

The `CommentMark` shows the Mark side: it adds highlighting to text spans without changing document structure. Key design choices: `inclusive: false` (the mark doesn't extend when typing at its boundary) and `excludes: ''` (multiple comment marks can overlap on the same text). This enables threaded inline comments where different discussions can reference overlapping passages.

We discovered this architecture through the test coverage work — `DetailsExtension.test.ts` had 3 failures because the content model changed from generic `block+` to the structured `detailsSummary detailsContent` pattern, and the tests hadn't been updated.

### How I would apply this in a future project

TipTap's content model strings are essentially a grammar for document structure, enforced at the editor level. This is a powerful pattern for any structured content editing — forms with required sections, templates with fixed layouts, or collaborative documents where structural integrity matters. The key insight is that you define constraints declaratively in the schema and get enforcement for free, rather than writing imperative validation code.

The `ReactNodeViewRenderer` pattern — schema defines structure, React defines presentation — is the right separation of concerns for complex editor UIs. The schema travels over the wire (via Yjs CRDTs for collaboration); the React components are client-only rendering. This means two users on different client versions can still collaborate, as long as the schema is backward-compatible.

For any project using ProseMirror or TipTap, I'd invest early in understanding content model strings and the Node/Mark/Extension taxonomy. The DetailsExtension pattern — parent node with typed children — is reusable for any collapsible, tabbed, or multi-section content block.
