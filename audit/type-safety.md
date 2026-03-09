# Type Safety Audit

**Date:** 2026-03-09
**Auditor:** Trench (treasury-ship-1bx)
**Branch:** task/1bx-type-safety-audit

---

## Methodology

**Tools:** ripgrep (`rg`) for pattern matching across `.ts` and `.tsx` files.
**Scope:** `api/`, `web/`, `shared/`, `e2e/` — excluding `node_modules/`, `dist/`, `build/`, `research/`.

**How each category was measured:**

- **`any` usage:** Pattern `:\s*any\b|<any>|,\s*any\b|\bas\s+any\b` — catches type annotations (`: any`), generic params (`<any>`), function params (`, any`), and cast expressions (`as any`).
- **`as X` type assertions:** Pattern `\bas\s+[A-Z]` — catches `as SomeType` casts. Filtered out `import ... as`, `export { default as`, and comment lines to avoid false positives. Counted separately from `as any` (which is in the `any` category).
- **Non-null assertions:** Pattern `\w!\.` — catches `foo!.bar` non-null assertion operator usage.
- **`@ts-ignore` / `@ts-nocheck`:** Literal string search.
- **Strict mode:** Manual inspection of all `tsconfig.json` files for `strict: true` and additional strictness flags.

Results were split by package and by test-vs-production files (`.test.ts`, `.spec.ts` = test; everything else = production).

---

## Summary

| Metric | Count |
|--------|-------|
| `any` usage | **272** |
| `as X` type assertions | **228** (prod only, after filtering re-exports) |
| Non-null assertions (`!.`) | **22** |
| `@ts-ignore` / `@ts-nocheck` | **0** |
| **Total violations** | **522** |

---

## Strict Mode Status

| Config | `strict` | Extra flags |
|--------|----------|-------------|
| Root `tsconfig.json` | **true** | `noUncheckedIndexedAccess`, `noImplicitReturns`, `noFallthroughCasesInSwitch` |
| `api/tsconfig.json` | **true** (extends root) | inherits all |
| `web/tsconfig.json` | **true** (standalone) | Missing: `noUncheckedIndexedAccess`, `noImplicitReturns`, `noFallthroughCasesInSwitch` |
| `shared/tsconfig.json` | **true** (extends root) | `composite: true` |
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

### Root Causes (production `any`, 90 instances)

| Pattern | Count | Example | Fixable? |
|---------|-------|---------|----------|
| Callback/handler params (`: any`) | ~48 | `(err: any)`, `(data: any)` in route handlers | Yes — type the params |
| `.d.ts` for untyped libs (y-protocols) | 11 | `transactionOrigin: any` in Yjs protocol types | No — upstream library is untyped |
| `Record<string, any>` | 6 | Loosely-typed property bags | Partially — use `unknown` or narrow |
| `catch (err: any)` | 2 | Scripts only | Yes — use `unknown` |
| Other | ~23 | Mixed patterns in route files | Case-by-case |

### Root Causes (test `any`, 182 instances)

| Pattern | Count | Why it exists |
|---------|-------|---------------|
| `as any` (mock coercion) | 156 | Casting partial objects to satisfy `pool.query` mock types |
| Other test `any` | 26 | Loose typing in test helpers |

**Assessment:** The 156 `as any` mock casts are the dominant pattern — tests create partial `{ rows: [...] }` objects and cast them to satisfy pg's `QueryResult` type. This is a common pg testing pattern. Fixable with a typed mock helper but low-severity since it's test-only.

## Per-Package Breakdown: `as X` assertions

| Package | Total | Test files | Prod files |
|---------|-------|------------|------------|
| api/ | 51 | 33 | 18 |
| web/ | 190 | 3 | 187 |
| shared/ | 0 | 0 | 0 |
| e2e/ | 16 | 16 | 0 |
| **Total** | **257** | **36** | **221** |

### Root Causes (production `as X`, ~221 instances)

| Pattern | Count | Severity | Fixable? |
|---------|-------|----------|----------|
| `as Error` in catch blocks | 35 | Low — standard TS pattern for `unknown` catch | Replace with `unknown` + narrowing |
| `as Record<string, ...>` (untyped data) | 31 | Medium — masks shape errors | Yes — add response types |
| `as Node`/`as HTMLElement` (DOM events) | 25 | None — required by DOM API (`event.target` is `EventTarget`) | No — inherent to DOM |
| `as Partial<...>` (data transforms) | 23 | Medium — bypasses required field checks | Yes — build objects correctly |
| `as DomainType` (UnifiedDocument, Issue, etc.) | 27 | High — masks API contract mismatches | Yes — type API responses properly |
| URL param casts (`as Tab`, `as DashboardView`) | 8 | Low — small enum sets, usually guarded | Add runtime check |
| Other | ~72 | Mixed | Case-by-case |

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

## Findings — Severity Ranked

### Severity 1 (High) — Structural gaps

**F1. `web/tsconfig.json` missing strict flags.**
Web does not extend root tsconfig and is missing `noUncheckedIndexedAccess`, `noImplicitReturns`, `noFallthroughCasesInSwitch`. This means array/map indexing returns `T` instead of `T | undefined` in the frontend — a real source of runtime errors. Quick fix but may surface new type errors.

**F2. `as DomainType` assertions bypass API contracts (27 instances).**
Files like `UnifiedEditor.tsx`, `useIssuesQuery.ts`, and `UnifiedDocumentPage.tsx` cast API responses to domain types (`as UnifiedDocument`, `as Issue`, `as BelongsTo[]`) without validation. If the API shape changes, these casts silently produce wrong types at runtime. This is the most dangerous category.

### Severity 2 (Medium) — Improvable with effort

**F3. `as Record<string, ...>` and `as Partial<...>` weaken shape checking (54 instances).**
These are "I know this is roughly the right shape" casts, mostly in web hooks dealing with API response properties. They mask missing or renamed fields.

**F4. Callback/handler params typed as `any` (48 instances).**
Route handlers and event callbacks in api/ use `any` for parameters that could be properly typed with Express generics or specific interfaces. Medium risk — the `any` propagates through the function body.

### Severity 3 (Low) — Acceptable or inherent

**F5. `as Error` in catch blocks (35 instances).**
Standard TypeScript pattern. `catch` gives `unknown`, code narrows with `as Error`. Could use `instanceof` checks instead, but low risk in practice.

**F6. `as Node`/`as HTMLElement` for DOM events (25 instances).**
Inherent to the DOM API — `event.target` is `EventTarget`, must be cast to `Node`/`HTMLElement`. Not fixable, not a problem.

**F7. Test mock `as any` (156 instances).**
Tests casting `{ rows: [...] }` to satisfy pg `QueryResult`. Standard pg mock pattern. Could be improved with a typed helper (`mockQueryResult(rows)`) but zero production risk.

**F8. `.d.ts` for untyped y-protocols (11 instances).**
Type declarations for the Yjs collaboration library, which has no official types. These `any` instances are in type shims and can't be eliminated without upstream changes.

### Not a finding

**F9. Zero `@ts-ignore` and `@ts-nocheck`.** The codebase never suppresses the compiler — all type issues are handled (even if via `any` or casts). This is genuinely good discipline.

---

## Improvement Priorities (for Phase 2)

| Priority | Action | Violations fixed | Effort |
|----------|--------|-----------------|--------|
| 1 | Add missing strict flags to `web/tsconfig.json` | config gap | Low (but may surface errors) |
| 2 | Type API responses in web hooks (eliminate `as DomainType`) | ~27 | Medium |
| 3 | Replace `as Record/Partial` with proper types in web | ~54 | Medium |
| 4 | Type Express route handler params in api/ | ~48 | Medium |
| 5 | Add typed `mockQueryResult` helper for tests | ~156 | Low |
| 6 | Replace `as Error` with `instanceof` narrowing | ~35 | Low |
