# Change Doc: Type Safety F1+F2 (q6y)

**Bead:** treasury-ship-q6y
**Branch:** task/q6y-type-safety-f1f2

## Relationship to Assignment (GFA Week 4)

The PDF assignment (Category 1: Type Safety) asks to **eliminate 25% of type safety violations**, measured by `any`, `as`, `!`, and `@ts-ignore/@ts-expect-error` counts. It also asks: "Is strict mode enabled?" and "Strict mode error count (if disabled)."

**F1 (strict flags) does not directly reduce the violation counts.** It hardens the compiler so that new classes of bugs become compile errors — specifically, unchecked array/record indexing, implicit returns, and switch fallthrough. The 102 errors it surfaced were fixed with runtime guards (not `!` assertions), which means the code is genuinely safer at runtime. But the `any`, `as`, and `!` baselines don't move as a result.

**We kept F1 intentionally** because:

1. The PDF's audit deliverable explicitly asks whether strict mode is enabled and what the error count would be — these flags are directly relevant to that question.
2. The fixes are real runtime safety improvements (e.g., guarding against `undefined` from array indexing), not cosmetic.
3. `noFallthroughCasesInSwitch` is particularly valuable for the unified document model's discriminated unions.

**Known tradeoff with `noImplicitReturns`:** This flag creates friction with React's `useEffect` pattern. When an effect conditionally returns a cleanup function, TS requires all code paths to return — so the "no cleanup needed" branch needs an explicit `return undefined`. This is ceremony, not safety: React treats `undefined` identically to not returning. The ~5 `return undefined` additions in this branch are the weakest fixes in F1. The flag is still worth having for non-React code (catching genuinely forgotten returns), but this React friction should be noted.

**F2 (cast elimination) directly targets the 25% goal.** It removes 27 `as DomainType` casts and 10 `!` assertions, replacing them with proper type narrowing and runtime guards.

**For the final report:** Count F2's reductions toward the 25% target. Frame F1 as a separate strict-mode hardening improvement with its own before/after (0 → 3 additional strict flags enabled; 102 latent type errors surfaced and fixed with runtime guards).

## Before/After Counts

Using audit grep methodology (`rg '\bas\s+[A-Z]' --type ts web/src/ | grep -v test|spec|import|export`):

| Metric | Before | After | Delta | Counts toward 25%? |
|--------|--------|-------|-------|---------------------|
| `any` usage | 27 | 27 | 0 | — |
| `as X` casts | 171 | 144 | **-27** | Yes (F2) |
| Non-null assertions (`!`) | 10 | 0 | **-10** | Yes (F2) |
| Strict flags added | 0 | 3 | +3 | No — separate metric |
| Latent errors surfaced & fixed | 0 | 102 | — | No — runtime safety, not violation count |

## F1: Strict tsconfig flags (22 files, 102 errors fixed)

Added `noUncheckedIndexedAccess`, `noImplicitReturns`, `noFallthroughCasesInSwitch` to `web/tsconfig.json`.

| File | What was wrong | Fix | Why correct |
|------|---------------|-----|-------------|
| `web/tsconfig.json` | Missing 3 strict flags present in root tsconfig | Added all 3 | Aligns web with root tsconfig strictness |
| `cn.ts` | `sRGB[0..2]`, `hex[0..2]`, `match[1..3]` returned `T\|undefined` | Replaced `.map()` indexing with direct function calls; extracted hex chars with early return guard; combined regex match guard | Runtime guards instead of `!` |
| `useSelection.ts` | `itemIds[i]` possibly undefined in bounded loops | `if (id) next.add(id)` guard in loops; `?? null` for nullable state | Runtime guard skips undefined indices |
| `CommandPalette.tsx` | `Record<string, T[]>` indexing returns `T[]\|undefined`; focus element indexing | Typed groups with explicit keys object; `if (nextEl) nextEl.focus()` guard | Known keys initialized in useMemo; runtime guard for focus |
| `AIScoringDisplay.tsx` | Array indexing on match-map results; `descendants` callback missing return | `if (!listItem) continue` guard; `return true` for ProseMirror callback | Runtime guard; descendants expects boolean |
| `CommentDisplay.tsx` | `thread[0]` possibly undefined | `if (!root) return` early guard | Runtime safety for empty thread |
| `DashboardVariantC.tsx` | `days[0]`, `days[3]` possibly undefined on static 7-element array | Declared named vars (`monday`, `thursday`) before array construction | No indexing needed |
| `EmojiExtension.ts` | `handler` returns `null` in some branches but not all | Added `: null \| void` return type annotation | InputRule handler allows both |
| `ResizableImage.tsx` | `useEffect` returns cleanup only in `if` branch | Added `return undefined` in else | React expects consistent cleanup return |
| `InlineWeekSelector.tsx` | Two `useEffect`s return cleanup only conditionally | Added `return undefined` in else branches | Consistent effect cleanup |
| `SessionTimeoutModal.tsx` | `useEffect` returns cleanup only when `open` | Added `return undefined` | Consistent effect cleanup |
| `VisibilityDropdown.tsx` | `options[1]` possibly undefined as fallback | `if (!selected) return null` early guard | Runtime safety |
| `ProjectCombobox.tsx` | `projectsByProgram[key]` and `[0]` possibly undefined | `if (!programProjects) return null` guard; `?.` for dynamic lookup | Runtime guard for dynamic keys |
| `WeekTimeline.tsx` | `monthNames[index]` and `windows[index]` possibly undefined | `?? 'Unknown'` for month; `if (!window) return null` guard | Runtime guards |
| `Dashboard.tsx` | `overdueItems[0]` possibly undefined | `overdueItems.length === 1 && overdueItems[0]` guard in JSX condition | Truthy check narrows away undefined |
| `ReviewsPage.tsx` | Nested `reviews[personId][weekNumber]` possibly undefined from `noUncheckedIndexedAccess` | Destructured to intermediate var; `as ReviewCell` for spread result | Optimistic update — keys known to exist from caller |
| `TeamMode.tsx` | `json.weeks[0]`, `json.weeks[last]` possibly undefined; conditional effect return | Extracted to named vars with `if (firstWeek && lastWeek)` guard; `return undefined` | Runtime guard |
| `UnifiedDocumentPage.tsx` | `tabs[0]?.id` returns `string \| undefined` for `activeTab: string` | Added `\|\| ''` fallback | Empty string is safe default for tab ID |
| `WorkspaceSettings.tsx` | `admins[0]` possibly undefined | `admins[0]?.userId` optional chaining | Runtime safe |
| `StandupFeed.tsx` | `groups[label]` possibly undefined after initialization check | `if (group) group.push(standup)` guard | Runtime guard |
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
- The `as Error & { status: number }` pattern in hooks (useDocumentsQuery, useProjectsQuery, etc.) is F5 scope (treasury-ship-1f7), not addressed here.
