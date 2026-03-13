# Test Coverage: Fix 13 Failing Web Unit Tests (2fo)

Relates to: treasury-ship-2fo (child of test coverage epic)

## Per-File Summary

| File | Failures | What Was Stale | What Changed |
|------|----------|----------------|--------------|
| `document-tabs.test.ts` | 9 | Tab ID `'sprints'` renamed to `'weeks'`; project tab order changed (issues first); sprint gained tabs | Updated all `'sprints'` → `'weeks'` ID assertions; changed first-project-tab expectation from `'details'` to `'issues'`; sprint tests now expect tabs instead of empty array; project weeks label assertions updated to static (no longer count-driven) |
| `DetailsExtension.test.ts` | 3 | Content model changed from `'block+'` to structured `'detailsSummary detailsContent'` | Updated content assertion; registered `DetailsSummary` + `DetailsContent` companion extensions in editor instantiation tests |
| `useSessionTimeout.test.ts` | 1 | `resetTimer()` refactored to call `apiPost('/api/auth/extend-session')` which goes through CSRF token flow; test mock didn't handle CSRF fetch chain, causing extend-session to throw and trigger `onTimeout` | Added `vi.mock('@/lib/api')` to mock `apiPost` directly, bypassing CSRF flow. Stale test, not a real bug in the hook. |

## Root Causes

- **Tab refactor**: Tab IDs were renamed (`sprints` → `weeks`) and reordered (issues moved to first position for projects). Sprint documents gained dynamic tabs based on status.
- **Extension refactor**: `DetailsExtension` moved from generic `block+` content to structured child nodes (`detailsSummary` + `detailsContent`) for proper collapsible toggle behavior.
- **Session timeout refactor**: `resetTimer` gained server-side session extension via `apiPost`, but the test only mocked `global.fetch` without handling the CSRF token fetch chain that `apiPost` requires.
