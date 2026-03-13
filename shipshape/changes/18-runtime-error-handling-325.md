# Runtime Error Handling — 3 error gaps (325)

Relates to: treasury-ship-325 — "Fix 3 error handling gaps. At least one must
involve real user-facing data loss or confusion."

## GAP 1 — U1+U2: Collaboration persistence fire-and-forget (DATA LOSS)

**Files:** `api/src/collaboration/index.ts` (2 call sites)

**Before:** `persistDocument()` called without `.catch()` at two sites:

- Line ~186: `setTimeout` callback (debounced persistence, every 2s after edits)
- Line ~769: WebSocket close handler (final persist before cleanup)

If `persistDocument` threw before its internal try/catch (e.g., `Y.encodeStateAsUpdate`
throws), the rejection was unhandled — no log, no retry, edits silently lost.

**After:** Both call sites have `.catch()` handlers that:

1. Log the document name and ID with `[Collaboration]` prefix
2. Retry the persist once
3. Log the retry failure if that also fails

**Reproduction:** Kill the PostgreSQL connection while a user is editing a
document. Close the browser tab. Previously: no error logged, edits lost.
Now: error logged with document context, retry attempted.

## GAP 2 — U3: No process-level unhandled rejection/exception handlers (SERVER STABILITY)

**File:** `api/src/index.ts`

**Before:** Unhandled async errors caused silent crashes with no log entry.

**After:** Two handlers added near the top of the file:

- `process.on('unhandledRejection')` — logs error and promise, server continues
- `process.on('uncaughtException')` — logs error with stack trace, calls `process.exit(1)`
  (process is in undefined state after uncaught exception)

**Reproduction:** Add `setTimeout(() => Promise.reject(new Error('test')), 1000)`
to any route. Previously: no log output. Now: `[Process] Unhandled promise
rejection: Error: test` appears in server logs.

## GAP 3 — S2: WeekReconciliation silent mutations (USER CONFUSION)

**File:** `web/src/components/WeekReconciliation.tsx`

**Before:** 3 of 4 mutations (`moveToNextSprint`, `moveToBacklog`, `closeIssue`)
had no `onError` handler. On API failure:

1. Button stayed in pending/disabled state (never reset)
2. No error feedback to user
3. User assumed action succeeded — issue didn't actually move

The 4th mutation (`moveAllToBacklog`) already had `onError` resetting
`setBulkPending(false)`.

**After:** All 3 mutations have `onError: () => { setPendingAction(null); }`.
The global `MutationCache.onError` handler (in `lib/queryClient.ts:166-171`)
already shows error toasts via `notifyMutationError`, so no additional toast
logic was needed — just the local state reset.

**Reproduction:** Disconnect network, click "Move to Next Sprint" on any issue
in week reconciliation. Previously: button stuck disabled, no feedback. Now:
error toast appears, button resets to clickable.

## Per-File Change Table

| File | Change | Lines |
|------|--------|-------|
| `api/src/collaboration/index.ts` | `.catch()` + retry on both `persistDocument` call sites | ~186, ~769 |
| `api/src/index.ts` | `process.on('unhandledRejection')` and `process.on('uncaughtException')` | near top |
| `web/src/components/WeekReconciliation.tsx` | `onError` handlers on 3 mutations | ~153, ~183, ~211 |

## Tradeoffs

- **Single retry, not queue:** The persist retry is a simple immediate retry,
  not a retry queue with backoff. If both attempts fail, edits are lost. A retry
  queue would add complexity without clear benefit — if the DB is down, retrying
  won't help; if it was a transient blip, one retry is enough.
- **No graceful shutdown on uncaughtException:** We log and exit(1). A graceful
  shutdown (draining connections, flushing pending persists) would be better but
  is a larger change outside this task's scope.
