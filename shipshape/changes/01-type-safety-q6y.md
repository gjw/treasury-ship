# Change Doc: Type Safety F1+F2 (q6y)

**Bead:** treasury-ship-q6y
**Branch:** task/q6y-type-safety-f1f2
**Commits:** 2 (F1 checkpoint + F2)

## Before/After Counts

Using audit grep methodology (`rg '\bas\s+[A-Z]' --type ts web/src/ | grep -v test|spec|import|export`):

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| `any` usage | 27 | 27 | 0 |
| `as X` casts | 171 | 144 | **-27** |
| Non-null assertions | 10 | 11 | +1 |

## F1: Strict tsconfig flags (22 files, 102 errors fixed)

Added `noUncheckedIndexedAccess`, `noImplicitReturns`, `noFallthroughCasesInSwitch` to `web/tsconfig.json`.

| File | What was wrong | Fix | Why correct |
|------|---------------|-----|-------------|
| `web/tsconfig.json` | Missing 3 strict flags present in root tsconfig | Added all 3 | Aligns web with root tsconfig strictness |
| `cn.ts` | `sRGB[0..2]`, `hex[0..2]`, `match[1..3]` returned `T\|undefined` | Replaced `.map()` indexing with direct function calls; `!` for hex/regex | Bounds proven by `.length === 3` and 3 capture groups |
| `useSelection.ts` | `itemIds[i]` possibly undefined in bounded loops | `!` where loop bounds guarantee; `?? null` for nullable state | Loop guards ensure valid indices |
| `CommandPalette.tsx` | `Record<string, T[]>` indexing returns `T[]\|undefined`; focus element indexing | Typed groups with explicit keys object; `?.focus()` for focus | Known keys initialized in useMemo; defensive for focus |
| `AIScoringDisplay.tsx` | Array indexing on match-map results; `descendants` callback missing return | `!` for map-matched indices; `return true` for ProseMirror callback | Match map guarantees indices exist; descendants expects boolean |
| `CommentDisplay.tsx` | `thread[0]` possibly undefined | `thread[0]!` — called only when `thread.length > 0` | Guard ensures non-empty |
| `DashboardVariantC.tsx` | `days[0]`, `days[3]` possibly undefined on static 7-element array | Destructured to named vars with `!` | Static array, indices 0 and 3 always exist |
| `EmojiExtension.ts` | `handler` returns `null` in some branches but not all | Added `: null \| void` return type annotation | InputRule handler allows both |
| `ResizableImage.tsx` | `useEffect` returns cleanup only in `if` branch | Added `return undefined` in else | React expects consistent cleanup return |
| `InlineWeekSelector.tsx` | Two `useEffect`s return cleanup only conditionally | Added `return undefined` in else branches | Consistent effect cleanup |
| `SessionTimeoutModal.tsx` | `useEffect` returns cleanup only when `open` | Added `return undefined` | Consistent effect cleanup |
| `VisibilityDropdown.tsx` | `options[1]` possibly undefined as fallback | `?? options[1]!` — static 2-element array | Fallback always exists |
| `ProjectCombobox.tsx` | `projectsByProgram[key]` and `[0]` possibly undefined | `?.` for dynamic lookup; `!` after `Object.keys` guarantees key exists | Keys iterated from same object |
| `WeekTimeline.tsx` | `monthNames[index]` and `windows[index]` possibly undefined | `?? 'Unknown'` for month; `!` after `findIndex !== -1` guard | Month array is static 12 elements; guard ensures valid index |
| `Dashboard.tsx` | `overdueItems[0]` possibly undefined | `overdueItems[0]!` — inside `length === 1` guard | Guard ensures element exists |
| `ReviewsPage.tsx` | Nested `reviews[personId][weekNumber]` possibly undefined from `noUncheckedIndexedAccess` | Destructured to intermediate var; `as ReviewCell` for spread result | Optimistic update — keys known to exist from caller |
| `TeamMode.tsx` | `json.weeks[0]`, `json.weeks[last]` possibly undefined; conditional effect return | `!` inside `length > 0` guard; `return undefined` | Guard ensures non-empty |
| `UnifiedDocumentPage.tsx` | `tabs[0]?.id` returns `string \| undefined` for `activeTab: string` | Added `\|\| ''` fallback | Empty string is safe default for tab ID |
| `WorkspaceSettings.tsx` | `admins[0]` possibly undefined | `admins[0]!` inside `length === 1` guard | Guard ensures element exists |
| `StandupFeed.tsx` | `groups[label]` possibly undefined after initialization check | `groups[label]!` — preceded by `if (!groups[label]) groups[label] = []` | Initialization guarantees non-undefined |
| `WeekSidebar.tsx` | `OPM_RATING_LABELS[rating]` possibly undefined | Changed `.label` to `?.label` | Defensive — rating might not be in map |
| `TableOfContents.test.ts` | `headings[0]`, `headings[1]`, `headings[2]` possibly undefined | `!` after `toHaveLength(N)` assertion | Assertion proves indices exist |

## F2: Domain-type cast elimination (4 files, 27 casts removed)

| File | What was wrong | Fix | Why correct |
|------|---------------|-----|-------------|
| `useUnifiedDocuments.ts` | 4 `as WikiDocument[]`, `as Issue[]`, `as Project[]`, `as Program[]` — unnecessary casts on typed query data | Replaced `(query.data \|\| []) as T[]` with `query.data ?? []` | `useQuery<T[]>` returns `T[] \| undefined`; `?? []` infers `T[]` without cast |
| `useIssuesQuery.ts` | `transformIssue` took `Record<string, unknown>` and cast to `as Issue`; `data as Record<string, unknown>[]` for API response | Added `ApiIssueResponse` interface (extends `Omit<Issue, 'belongs_to'>` with optional `belongs_to`); typed `res.json()` return | Proper boundary type makes `{...apiIssue, belongs_to}` satisfy `Issue` without cast |
| `UnifiedEditor.tsx` | 8 `as IssueDocument`/`as ProjectDocument`/`as SprintDocument` for field access; 10 `as WikiSidebarData`/etc. sidebar casts; 3 `as DocumentType` casts | Added `isIssueDocument`/`isProjectDocument`/`isSprintDocument` type guards for narrowing past `BaseDocument`; added `narrowSidebarData<K>` typed helper; removed redundant casts (subtype already assignable to supertype) | Type guards narrow `UnifiedDocument` union correctly despite `BaseDocument` catch-all; sidebar helper provides type-safe access per document_type; `SelectableDocumentType` is subtype of `DocumentType` |
| `PropertiesPanel.tsx` | 7 `document as WikiDocument`/`as IssueDocument`/etc. in switch cases; 1 `as BaseDocument` in default; 1 `as SprintDocument` for field access | Removed all document casts — `PanelDocument` discriminated union narrows correctly in switch; added `never` exhaustive check in default; used narrowing for sprint field access | `PanelDocument` members have literal `document_type` discriminators; TypeScript narrows in each case branch |

### Additional fix discovered

`ProjectSidebarData.programs` was missing `color: string` property — the `as ProjectPanelProps` cast had masked this type mismatch. Added `color` to the interface.

## Deployment & Testing

```bash
pnpm build:shared && pnpm type-check   # Verify types pass
pnpm test                                # Unit tests (needs local PostgreSQL)
pnpm dev                                 # Start dev server, manual verify
```

## What to know for next time

- `UnifiedDocument` includes `BaseDocument` as a catch-all, which prevents discriminated union narrowing on `document_type`. Type guards are needed to narrow past it. Consider removing `BaseDocument` from the union in a future cleanup (treasury-ship-t53 may address this).
- `PanelDocument` in PropertiesPanel does NOT include `BaseDocument`, so its discriminated union narrows correctly in switch cases.
- The `as Error & { status: number }` pattern in hooks (useDocumentsQuery, useProjectsQuery, etc.) is F3 scope (treasury-ship-t53), not addressed here.
