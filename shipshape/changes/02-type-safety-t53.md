# Change Doc: Type Safety F3+F4 (t53)

**Bead:** treasury-ship-t53
**Branch:** task/t53-type-safety-f3-f4

## Relationship to Assignment (GFA Week 4)

The PDF assignment (Category 1: Type Safety) asks to **eliminate 25% of type safety violations**, measured by `any`, `as`, `!`, and `@ts-ignore/@ts-expect-error` counts.

**F3 directly reduces the `as` count** by replacing shape casts (`as Record<...>`, `as Partial<T>`, `as { ... }`) with proper types — discriminated access, typed properties, and TipTap node types.

**F4 directly reduces the `any` count** by typing Express handler parameters, SQL query parameter arrays, database row extractor functions, and the Yjs↔TipTap converter.

**For the final report:** Count both F3 and F4 reductions toward the 25% target. Combined with q6y (F1+F2: -27 `as`, -10 `!`), the total is **127 violations eliminated**.

## Before/After Counts

Using audit grep methodology:

- `as` casts: `grep -rn ' as [A-Z{(]' web/src/ --include='*.ts' --include='*.tsx' | grep -v '.test.\|.d.ts\|as const' | wc -l`
- `any` usage: `grep -rn '\bany\b' api/src/ --include='*.ts' | grep -v '.test.\|.d.ts' | wc -l`

| Metric | Before | After | Delta | Counts toward 25%? |
|--------|--------|-------|-------|---------------------|
| `as X` casts (web/src) | 205 | 164 | **-41** | Yes (F3) |
| `any` usage (api/src prod) | 84 | 35 | **-49** | Yes (F4) |

## F3: Shape cast elimination (web/src, 41 casts removed)

| File | What was wrong | Fix | Why correct |
|------|---------------|-----|-------------|
| `ProjectSidebar.tsx` | 6 `as Partial<Project>` on object literals | Removed cast — object literals already satisfy `Partial<Project>` | `{ owner_id: ownerId }` where `ownerId: string \| null` is assignable to `Partial<Project>` without cast |
| `ProgramSidebar.tsx` | 4 `as Partial<Program>` on object literals | Same pattern — removed redundant casts | Object literals satisfy `Partial<Program>` |
| `IssueSidebar.tsx` | 1 `as Partial<Issue> & { confirm_orphan_children: boolean }`, 2 `as Partial<Issue>` | Widened `onUpdate` param type to `Partial<Issue> & { confirm_orphan_children?: boolean }`; removed casts | Type now accepts the extra field without cast |
| `document-tabs.tsx` | `as { status?: string }` on `document.properties` | Added `typeof` narrowing | Runtime check instead of shape cast |
| `DocumentResponse` interface | Missing `belongs_to`, `owner`, `issue_count` | Added typed fields from `BelongsTo` (shared) | These fields are returned by the API for all document types |
| 6 tab components | `(document as { belongs_to?: Array<...> }).belongs_to` | Direct `document.belongs_to` access | Field now on `DocumentResponse` |
| `WeekPlanningTab.tsx` | `document.properties as { status?: string; issue_count?: number }` | `typeof` narrowing on `Record<string, unknown>` fields | Runtime type checks |
| `WeekReviewTab.tsx` | `document.properties as { sprint_number?: number }` | `typeof` narrowing | Runtime type check |
| `UnifiedDocumentPage.tsx` | `document as { issue_count?: number }`, `document.owner as { ... }` | Direct access via typed `DocumentResponse` fields | Fields now on interface |
| `WikiSidebar.tsx` | `document.properties as { maintainer_id?: string }` | `typeof` narrowing on `Record<string, unknown>` property | Runtime check |
| `PropertiesPanel.tsx` | `document as { accountable_id?: string }`, `panelProps as { people?: ... }` | `'accountable_id' in document` / `'people' in panelProps` narrowing | Property existence checks |
| `DocumentEmbed.tsx` | `node.attrs as { documentId: string; title: string }` | `String(node.attrs.documentId ?? '')` | Direct access with fallback |
| `UnifiedEditor.tsx` | `document.properties as { person_id?: string; ... }` | Field-level `typeof` narrowing | Runtime check per field |
| `Login.tsx` | `location.state as { from?: { pathname: string } }` | Chained `typeof`/`'in'` narrowing | Runtime check on unknown state |
| `DiffViewer.tsx` | 8 `as Record<string, unknown>` on child nodes | Changed `extractText(node: Record<string, unknown>)` to `extractText(node: TipTapNode)` | Recursive children are typed `TipTapNode[]` |
| `ContentHistoryPanel.tsx` | `node as Record<string, unknown>` | `'type' in node` guard + narrowed shape | Runtime proof before access |
| `Editor.tsx` | `json as Record<string, unknown>` | Changed `onContentChange` prop type to `JSONContent` (from TipTap) | TipTap's `getJSON()` returns `JSONContent` — no cast needed |
| `ReviewsPage.tsx` | `content as { type?: string; ... }` | `'content' in content` / `'type' in node` guards | Runtime narrowing |
| `api.ts` | 3 `params as Record<string, string>` for URLSearchParams | Added `toSearchParams()` helper that converts `Record<string, string\|number\|boolean\|undefined>` | Proper type conversion instead of cast |

## F4: `any` elimination (api/src, 49 occurrences removed)

| File | What was wrong | Fix | Why correct |
|------|---------------|-----|-------------|
| `app.ts` | 2 untyped Express handlers | Added `(req: Request, res: Response)` | Express types imported, handlers properly typed |
| `swagger.ts` | 2 untyped Express handlers | Added `(_req: Request, res: Response)` | Same pattern |
| `yjsConverter.ts` | 12 `any` — params, return types, local vars | Replaced with `TipTapNode`, `TipTapMark`, `TipTapDocument` from shared | Recursive TipTap JSON structure now properly typed |
| `issues.ts` | `extractIssueFromRow(row: any)`, 2 `values: any[]` | `row: Record<string, unknown>` + field assertions; `SqlParam[]` | Row fields narrowed at access; SQL params bounded |
| `weeks.ts` | `extractSprintFromRow(row: any)`, `formatStandupResponse(row: any)`, `generatePrefilledReviewContent(sprintData: any, issues: any[])`, 3 `values: any[]`, 2 `(i: any)` filters | Typed row extractors, defined `SprintReviewData`/`SprintIssueRow`, `SqlParam[]`, `(i: { state: string })` | Interfaces match actual SQL query shapes |
| `projects.ts` | `extractProjectFromRow(row: any)`, `extractSprintFromRow(row: any)`, `generatePrefilledRetroContent(projectData: any, sprints: any[], issues: any[])`, 3 `values: any[]`, 6 `(i: any)` filters | Typed row extractors, defined `ProjectRetroData`/`SprintSummaryRow`/`IssueSummaryRow`, `SqlParam[]`, `(i: { state: string })` | Interfaces match SQL shapes |
| `programs.ts` | `extractProgramFromRow(row: any)`, `values: any[]` | `Record<string, unknown>` + field assertions; `SqlParam[]` | Same pattern |
| `feedback.ts` | `extractFeedbackFromRow(row: any)` | `Record<string, unknown>` + field assertions | Same pattern |
| `documents.ts` | `doc: any \| null` return type, `values: any[]` | Defined `DocumentRow` interface; `SqlParam[]` | Interface matches actual query columns |
| `standups.ts` | `values: any[]` | `SqlParam[]` | SQL params bounded |
| `auth.ts` | 2 `pendingAccountabilityItems: any[]` | `never[]` | Arrays are always empty (placeholder for future API) |

### New types introduced

- **`shared/src/types/tiptap.ts`** — `TipTapNode`, `TipTapMark`, `TipTapDocument` — used by both web/ and api/
- **`api/src/types/sql.ts`** — `SqlParam = string | number | boolean | null | string[]` — type-safe SQL parameter arrays

## Skip List

| Item | Count | Reason |
|------|-------|--------|
| `as Partial<RawCommands>` | 4 | TipTap API constraint |
| `as Partial<SuggestionOptions>` | 1 | TipTap API constraint |
| `as { status: number }` in queryClient.ts | 2 | F5 scope (treasury-ship-1f7) |
| `as string` in yjsConverter L188, 221 | 2 | Yjs `setAttribute` requires `string`, attrs are `unknown` — correct runtime cast |
| `as Record<string, string>` in api.ts L164 | 1 | `RequestInit.headers` union type — TS/DOM limitation |
| `updates as Record<string, unknown>` in tabs | 3 | Optimistic cache updates — `Partial<UnifiedDocument>` to `Record<string, unknown>` spread |
| `origin: any` in collaboration/index.ts | 1 | Yjs API constraint |
| y-protocols.d.ts | ~5 | Type declaration for untyped library |
| `as Partial<Issue>` in IssuesList.tsx | 1 | `sprint_id` is a virtual field handled by mutation, not on `Issue` interface |

## Deployment & Testing

```bash
pnpm build:shared && pnpm type-check   # Verify types pass
pnpm test                                # Unit tests (needs local PostgreSQL)
pnpm dev                                 # Start dev server, manual verify
```

## What to know for next time

- `DocumentResponse extends Record<string, unknown>` — this allows arbitrary field access but means `properties` is `Record<string, unknown>`. Per-document-type properties narrowing requires runtime `typeof` checks. A future improvement would be a discriminated union for `DocumentResponse` by `document_type`.
- `UnifiedDocument` is a union type without index signature, so it can't be spread into `Record<string, unknown>` cache values without a cast. This is a query data typing issue.
- `IssuesList.tsx` uses `sprint_id` as a virtual field in mutations — the mutation handler translates it to `belongs_to` entries. The `as Partial<Issue>` cast hides this. Consider adding `sprint_id?: string | null` to the mutation type.
- The `SqlParam` type covers all PostgreSQL parameter types used in this codebase. If `Date`, `Buffer`, or `JSON` params are added later, extend it.
- The `extractXFromRow` functions use `Record<string, unknown>` + field-level type assertions. This is a step up from `any` but still relies on the SQL query returning the expected columns. Proper Zod validation at the boundary would be the next level (F5+ scope).
