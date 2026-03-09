# Type Safety Audit

**Date:** 2026-03-09
**Auditor:** Trench (treasury-ship-1bx)
**Branch:** task/1bx-type-safety-audit

---

## Summary

| Metric | Count |
|--------|-------|
| `any` usage | **272** |
| `as X` type assertions | **257** |
| Non-null assertions (`!.`) | **22** |
| `@ts-ignore` / `@ts-nocheck` | **0** |
| **Total violations** | **551** |

---

## Strict Mode Status

| Config | `strict` | Extra flags |
|--------|----------|-------------|
| Root `tsconfig.json` | **true** | `noUncheckedIndexedAccess`, `noImplicitReturns`, `noFallthroughCasesInSwitch` |
| `api/tsconfig.json` | **true** (inherits root) | — |
| `web/tsconfig.json` | **true** (standalone) | Missing: `noUncheckedIndexedAccess`, `noImplicitReturns`, `noFallthroughCasesInSwitch` |
| `shared/tsconfig.json` | **true** (inherits root) | `composite: true` |
| `e2e/` | **No tsconfig** | — |

**Gap:** `web/tsconfig.json` does not extend root and is missing three strict flags that api and shared have. This means the frontend has weaker type safety than the backend.

---

## Per-Package Breakdown: `any`

| Package | Total | Test files | Prod files |
|---------|-------|------------|------------|
| api/ | 234 | 179 | 55 |
| web/ | 31 | 0 | 31 |
| shared/ | 0 | 0 | 0 |
| e2e/ | 7 | 7 | 0 |
| **Total** | **272** | **182** | **90** |

67% of `any` usage is in test files. 90 instances are in production code — concentrated in api route handlers.

## Per-Package Breakdown: `as X` assertions

| Package | Total | Test files | Prod files |
|---------|-------|------------|------------|
| api/ | 51 | 33 | 18 |
| web/ | 190 | 3 | 187 |
| shared/ | 0 | 0 | 0 |
| e2e/ | 16 | 16 | 0 |
| **Total** | **257** | **36** | **221** |

86% of `as X` assertions are in production code. The web package dominates with 190 assertions, many in query hooks and the UnifiedEditor component.

## Per-Package Breakdown: Non-null assertions (`!.`)

| Package | Count |
|---------|-------|
| api/ | 1 |
| web/ | 10 |
| shared/ | 0 |
| e2e/ | 11 |
| **Total** | **22** |

---

## Top 5 Files (All Violations Combined)

| # | File | Violations |
|---|------|------------|
| 1 | `api/src/__tests__/transformIssueLinks.test.ts` | 37 |
| 2 | `api/src/services/accountability.test.ts` | 33 |
| 3 | `api/src/__tests__/auth.test.ts` | 33 |
| 4 | `web/src/components/UnifiedEditor.tsx` | 24 |
| 5 | `api/src/__tests__/activity.test.ts` | 21 |

## Top 5 Files — `any` Usage

| # | File | Count |
|---|------|-------|
| 1 | `api/src/__tests__/transformIssueLinks.test.ts` | 37 |
| 2 | `api/src/services/accountability.test.ts` | 32 |
| 3 | `api/src/__tests__/auth.test.ts` | 24 |
| 4 | `api/src/__tests__/activity.test.ts` | 21 |
| 5 | `api/src/routes/issues-history.test.ts` | 20 |

## Top 5 Files — `as X` Assertions

| # | File | Count |
|---|------|-------|
| 1 | `web/src/components/UnifiedEditor.tsx` | 24 |
| 2 | `web/src/components/sidebars/PropertiesPanel.tsx` | 13 |
| 3 | `api/src/mcp/server.ts` | 10 |
| 4 | `api/src/__tests__/auth.test.ts` | 9 |
| 5 | `web/src/hooks/useWeeklyReviewActions.ts` | 8 |

## Top 5 Files — Non-null Assertions

| # | File | Count |
|---|------|-------|
| 1 | `e2e/session-timeout.spec.ts` | 6 |
| 2 | `web/src/pages/MyWeekPage.tsx` | 4 |
| 3 | `web/src/components/Editor.tsx` | 3 |
| 4 | `web/src/pages/AdminWorkspaceDetail.tsx` | 2 |
| 5 | `e2e/accessibility-remediation.spec.ts` | 2 |

---

## Key Findings

1. **No `@ts-ignore` or `@ts-nocheck`** — excellent discipline.
2. **Strict mode is on everywhere** — but web is missing three additional strict flags.
3. **`any` is concentrated in test files** (67%) — production `any` is mostly in api route handlers dealing with untyped pg query results.
4. **`as X` assertions are the biggest production concern** — 221 in prod code, heavily in the web package's query hooks and editor components. These bypass type checking at runtime boundaries.
5. **Non-null assertions are minimal** (22 total) — well-controlled.

## Improvement Priorities

1. **Close the web tsconfig gap** — add `noUncheckedIndexedAccess`, `noImplicitReturns`, `noFallthroughCasesInSwitch` to `web/tsconfig.json`
2. **Reduce `as X` in web query hooks** — add proper response types or Zod validation at API boundaries
3. **Type api route handler params** — replace `any` in route handlers with proper Request/Response generics
4. **Add tsconfig for e2e/** — currently untyped
