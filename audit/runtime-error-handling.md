# Audit: Runtime Error and Edge Case Handling

**Category:** Runtime Error and Edge Case Handling (Category 6)
**Bead:** treasury-ship-35k
**Date:** 2026-03-10
**Status:** Audit complete — no code changes made

---

## Methodology

### Tools & Approach

- **Static code analysis** of all `api/src/` and `web/src/` files
- **Pattern search** for: error boundaries, try/catch, `.catch()`, floating promises, empty catch blocks, `process.on`, `unhandledRejection`, loading/error states
- **Component tree mapping** of ErrorBoundary coverage across all routes
- **API route audit** of all 28 route files for input validation (Zod usage, parameterized queries)
- **Manual testing checklist** provided separately (`audit/runtime-error-manual-tests.md`) for browser-based measurements (console errors, network disconnect, throttling)

### Scope

- `api/src/` — 28 route files, middleware, collaboration server, DB client
- `web/src/` — 100+ components, 25+ routes, hooks, contexts, services
- `shared/` — type definitions, error codes

---

## 1. Unhandled Promise Rejections (Server)

### Measurement

Searched all `api/src/` for: `process.on('unhandledRejection')`, floating promises (async calls without `await`/`.catch()`), empty `.catch(() => {})` blocks.

### Baseline

| Metric | Count |
|--------|-------|
| Process-level unhandled rejection handler | **0** |
| Process-level uncaught exception handler | **0** |
| Fire-and-forget async calls (no await, no catch) | **2** |
| Empty `.catch(() => {})` blocks | **3** |

### Findings

| # | Severity | Location | Description |
|---|----------|----------|-------------|
| U1 | **CRITICAL** | `api/src/collaboration/index.ts:186` | `persistDocument()` called in `setTimeout` callback without `await` or `.catch()`. If DB write fails, document state is silently lost. This is the scheduled persistence path — every collaborative document save goes through here. |
| U2 | **CRITICAL** | `api/src/collaboration/index.ts:769` | `persistDocument()` called in WebSocket `close` handler without `await` or `.catch()`. This is the "final persist before cleanup" — if it fails, last edits before disconnect are silently dropped. |
| U3 | **HIGH** | `api/src/index.ts` (entire file) | No `process.on('unhandledRejection')` or `process.on('uncaughtException')` handler. Any unhandled async error crashes the server silently with no logging. |
| U4 | **LOW** | `api/src/services/oauth-state.ts:67` | `pool.query('DELETE...').catch(() => {})` — opportunistic cleanup, intentionally silent. Acceptable but unlogged. |
| U5 | **LOW** | `api/src/routes/issues.ts:1002`, `documents.ts:1093` | `ROLLBACK.catch(() => {})` — transaction cleanup. Failure here means the transaction already errored. Acceptable pattern but unlogged. |

---

## 2. Error Boundary Coverage (Frontend)

### Measurement

Mapped the full React component tree from `web/src/main.tsx` and traced ErrorBoundary usage. Checked all 100+ `.tsx` components.

### Baseline

| Metric | Count |
|--------|-------|
| ErrorBoundary components defined | **1** (`web/src/components/ui/ErrorBoundary.tsx`) |
| Locations where ErrorBoundary is used | **2** |
| Routes protected by ErrorBoundary | **15** (via AppLayout `<Outlet />` wrapper) |
| Routes with NO ErrorBoundary | **6** |
| Components with heavy async ops but no local EB | **20+** |

### Findings

| # | Severity | Location | Description |
|---|----------|----------|-------------|
| E1 | **CRITICAL** | `web/src/components/Editor.tsx:980-982` | ErrorBoundary wraps only `<EditorContent>`, NOT the TipTap initialization, WebSocket provider setup, or Yjs CRDT sync. If editor init fails, no fallback UI — page hangs or crashes. |
| E2 | **HIGH** | `web/src/main.tsx` — `/setup`, `/login`, `/invite/:token` | Authentication routes have zero error boundary protection. A render error shows React white screen. |
| E3 | **HIGH** | `web/src/main.tsx` — `/admin`, `/admin/workspaces/:id` | Admin routes (5+ async ops each) have zero error boundary protection. |
| E4 | **HIGH** | `web/src/main.tsx` — `/feedback/:programId` | Public-facing feedback page has no error boundary. External users see white screen on error. |
| E5 | **MEDIUM** | All document tab components (`ProgramOverviewTab`, `ProjectDetailsTab`, `WeekOverviewTab`, etc.) | No per-tab error boundaries. A single tab error collapses the entire document page. 13 tab components affected. |
| E6 | **MEDIUM** | Provider tree (QueryClient, Auth, Workspace, RealtimeEvents) | All top-level providers mount before any ErrorBoundary. Provider errors crash the entire app with no recovery. |

### Coverage Map

```
UNPROTECTED:
  /feedback/:programId  (PublicFeedbackPage)
  /setup                (SetupPage)
  /login                (LoginPage)
  /invite/:token        (InviteAcceptPage)
  /admin                (AdminDashboardPage)
  /admin/workspaces/:id (AdminWorkspaceDetailPage)

PROTECTED (via AppLayout Outlet EB):
  /dashboard, /my-week, /docs, /documents/:id/*,
  /issues, /projects, /programs, /team/*, /settings/*
  (15 routes total)

PARTIALLY PROTECTED:
  Editor component — EditorContent only, not init
```

---

## 3. Silent Failures

### Measurement

Searched all `web/src/` for: mutations without `onError`, `.catch(() => {})`, API calls without error UI, `useQuery` where `error` is destructured but unused in JSX.

### Baseline

| Metric | Count |
|--------|-------|
| Mutations without onError handlers | **7** |
| Promise chains with `.catch(() => {})` (silent swallow) | **4** |
| useQuery error states ignored in render | **3** |
| API calls without user-facing error feedback | **7** |

### Findings

| # | Severity | Location | Description | User Impact |
|---|----------|----------|-------------|-------------|
| S1 | **CRITICAL** | `web/src/pages/MyWeekPage.tsx:45-90` | Create plan/retro/standup mutations: if API returns `!res.ok`, no error branch exists. `finally` resets button state. | User clicks "Create Plan", it fails silently. Button re-enables. User clicks again. And again. No idea creation failed. |
| S2 | **CRITICAL** | `web/src/components/WeekReconciliation.tsx:102-211` | 3 of 4 mutations (`moveToNextSprint`, `moveToBacklog`, `closeIssue`) have no `onError`. Only `moveAllToBacklog` handles errors. | Moving an issue fails silently. Button shows "..." loading then resets. Issue appears unmoved but user may think it moved. |
| S3 | **HIGH** | `web/src/pages/UnifiedDocumentPage.tsx:47-61` | `useQuery` destructures `error` but never checks it in JSX. | Document fails to load → infinite loading spinner. No error message, no retry button. |
| S4 | **HIGH** | `web/src/components/PlanQualityBanner.tsx:189-202` | AI analysis uses `.catch(() => {})` — completely silent. | AI analysis fails → user sees stale results with no indication of failure. |
| S5 | **HIGH** | `web/src/components/Editor.tsx:354-357, 430-433` | WebSocket and IndexedDB errors caught and logged to console only. No UI indicator. | Collaboration sync silently breaks. User types, thinks content is saved, closes tab → edits lost. |
| S6 | **MEDIUM** | `web/src/components/document-tabs/WeekOverviewTab.tsx:77-87` | `deleteMutation` has no `onError`. | Delete fails → user navigated away but document still exists. Confusion on return. |
| S7 | **MEDIUM** | `web/src/components/document-tabs/ProgramOverviewTab.tsx:69-79` | `deleteMutation` has no `onError`. | Same as S6. |
| S8 | **MEDIUM** | `web/src/components/sidebars/IssueSidebar.tsx:180-198` | Sprint fetch `.catch()` silently sets empty arrays. | Sprint picker shows empty when API fails. User thinks there are no sprints. |
| S9 | **MEDIUM** | `web/src/pages/Dashboard.tsx:59-103` | Standup fetch `catch` only logs to console. | Recent standups section empty with no explanation. |
| S10 | **LOW** | `web/src/hooks/useWeeklyReviewActions.ts:121-129` | Approver name fetch silently skipped on failure. | Approval shown without approver name — minor but confusing. |

---

## 4. Input Validation Gaps

### Measurement

Audited all 28 API route files for: Zod schema usage, raw `req.body`/`req.params` access, SQL concatenation, length limits, file upload validation.

### Baseline

| Metric | Count |
|--------|-------|
| Routes with full Zod validation | **~22** |
| Routes with partial or missing validation | **5** |
| SQL injection vectors | **0** (all parameterized) |
| XSS vectors | **0** (HTML escaping in place) |
| Missing length limits | **2** |

### Findings

| # | Severity | Location | Description |
|---|----------|----------|-------------|
| V1 | **HIGH** | `api/src/routes/invites.ts:116-120` | `POST /api/invites/:token/accept` — password and name extracted from `req.body` without Zod validation. Length check exists downstream but no schema. |
| V2 | **MEDIUM** | `api/src/routes/ai.ts:22-74` | AI analysis endpoints accept `content` without max length. Unbounded text sent to AI service. Potential DoS vector. |
| V3 | **MEDIUM** | `api/src/routes/files.ts:63-78` | File upload uses blocklist (`.exe`, `.bat`, etc.) instead of allowlist. MIME type parameter ignored. New dangerous extensions can slip through. |
| V4 | **MEDIUM** | `api/src/routes/documents.ts` | Document content (TipTap JSON) stored without size validation. Unbounded JSONB writes possible. |
| V5 | **LOW** | `api/src/routes/backlinks.ts:128-136` | Dynamic SQL structure via string concatenation (values are parameterized, structure is not). Fragile pattern. |
| V6 | **LOW** | `api/src/routes/claude.ts:60-105`, `feedback.ts:121-130` | Query params validated manually instead of Zod. Inconsistent with rest of codebase. |

**Positive notes:** All SQL queries use parameterized format. CSRF middleware in place. HTML escaping implemented. LIKE pattern injection prevented in search.

---

## 5. Network Disconnect Recovery

### Measurement (Static Analysis)

Analyzed WebSocket reconnection logic in `y-websocket` provider, React Query retry config, session timeout handling, and IndexedDB caching.

### Baseline (Static Assessment)

| Metric | Assessment |
|--------|------------|
| WebSocket auto-reconnect | **Yes** — `y-websocket` handles this natively |
| React Query retry | **Yes** — 3 retries for non-4xx errors |
| CSRF token retry | **Yes** — auto-retry once on 403 |
| Session extend on failure | **No** — forces logout immediately |
| IndexedDB offline cache | **Yes** — `y-indexeddb` persists Yjs state |
| Reconnect UI indicator | **Partial** — `wsProvider.on('status')` tracked but not always surfaced |

### Findings

| # | Severity | Location | Description |
|---|----------|----------|-------------|
| N1 | **HIGH** | `web/src/components/Editor.tsx:385-394` | WebSocket status changes (`connected`/`disconnected`) are tracked in state but the disconnect indicator may not be visible to users during brief interruptions. Needs manual verification. |
| N2 | **HIGH** | `api/src/collaboration/index.ts:186, 769` | If persistence fails during disconnect/reconnect cycle, edits are silently lost (same as U1/U2). |
| N3 | **MEDIUM** | `web/src/hooks/useSessionTimeout.ts:107-121` | Session extend fails → immediate logout. No retry, no grace period. Network blip during active use logs user out. |

**Note:** Full network disconnect recovery requires manual browser testing. See `audit/runtime-error-manual-tests.md`.

---

## Manual Test Results

Testing performed by Chair on 2026-03-10 against localhost dev server.

**Method:** `window.fetch` override to simulate network failures (DevTools Offline mode doesn't work on localhost). Server killed/restarted for WebSocket disconnect tests.

| Test | Result | Notes |
|------|--------|-------|
| Console errors (normal navigation) | **0 errors, 0 warnings** | Clean baseline across 8 pages |
| Network disconnect during editing | **Pass** | Data survived reconnect |
| Concurrent editing with disconnect | **Pass** | Edits merged correctly. Minor: HSL color format warning (`hsl(142, 70%, 60%)`) logged for user presence colors |
| Malformed input (empty, long, XSS, SQLi) | **Pass** | All handled correctly |
| 3G throttle | **Skipped** | Localhost not affected by DevTools throttling |
| Server logs | **1 error** | AWS Bedrock `CredentialsProviderError` in `ai-analysis.ts:248` — expected, no AWS creds locally. Gracefully caught. |
| Session timeout edge cases | **Pass** | |
| 8a: MyWeek create failure | **Pass** | Error state shown, queries logged in console |
| 8b: Reconciliation move failure | **Pass** | Toast displayed (brief). Mutation failures logged. |
| 8c: Document load failure | **FAIL** | WebSocket provider enters infinite reconnect loop. Console floods with `y-websocket` connection errors. Page stuck in loading state forever. No error UI, no timeout, no give-up. |

### Key Manual Finding: Infinite WebSocket Reconnect (8c)

**Reproduction:**
1. Override `window.fetch` to reject all requests
2. Navigate to any document page (`/documents/:id`)

**Observed behavior:** The `y-websocket` provider repeatedly attempts WebSocket connection (`ws://localhost:3001/collaboration/issue:...`) with no backoff and no maximum retry count. Console fills with connection errors. Page shows infinite loading spinner. No user-facing error message or recovery action.

**Confirmed from static analysis:** This aligns with finding S3 (UnifiedDocumentPage ignores query error state) and finding S5 (Editor WebSocket errors not surfaced to UI).

---

## Audit Deliverable Summary

| Metric | Your Baseline |
|--------|---------------|
| Console errors during normal usage | **0** |
| Unhandled promise rejections (server) | **2 critical** (collaboration persistence fire-and-forget), **0 global handlers** |
| Network disconnect recovery | **Partial** — data survives reconnect, but WebSocket has no give-up/error UI on sustained failure |
| Missing error boundaries | **6 unprotected routes**, **1 partial** (Editor init), **13 tab components**, **6 providers** |
| Silent failures identified | **10 from static analysis**, **1 confirmed in manual testing** (infinite WebSocket reconnect with no error UI) |

---

## Improvement Target

**Fix 3 error handling gaps.** At least one must involve a real user-facing data loss or confusion scenario.

### Recommended fixes (priority order):

1. **U1+U2: Collaboration persistence fire-and-forget** (DATA LOSS) — Add `.catch()` with retry logic to `persistDocument()` calls in collaboration/index.ts. Users can lose edits when WebSocket closes if DB write fails.

2. **8c + S3 + S5: WebSocket infinite reconnect with no error UI** (USER CONFUSION / DATA LOSS RISK) — Add a retry limit or exponential backoff to WebSocket reconnection. After N failures, show an error state with "Connection lost — retry" button instead of infinite loading. Surface `wsProvider` disconnect status in the Editor UI.

3. **U3: Add process-level unhandled rejection handler** (SERVER STABILITY) — A single unhandled promise rejection crashes the entire server with no logging.

4. **E1: Editor initialization error boundary** (DATA LOSS RISK) — Wrap full editor initialization in ErrorBoundary so WebSocket/CRDT failures show recovery UI instead of hanging.

5. **S2: WeekReconciliation mutation error handlers** (USER CONFUSION) — 3 of 4 mutations silently fail when moving issues between sprints.
