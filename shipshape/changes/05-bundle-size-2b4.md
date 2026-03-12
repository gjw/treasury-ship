# Change Doc: Bundle Size — lazy-load heavy deps (2b4)

**Bead:** treasury-ship-2b4
**Branch:** task/2b4-lazy-load-heavy-deps

## Relationship to Assignment

The assignment requires dynamic `import()` for emoji-picker-react (400KB), lowlight/highlight.js (378KB), and diff-match-patch (81KB). All three are interaction-triggered features that don't need to be in the initial or route-level bundles. This builds on route-level code splitting (mgc) to go deeper — splitting within route chunks. "Removing functionality to shrink the bundle does not count." All three features still work, just loaded on demand.

## Before/After Build Numbers

| Chunk | Before | After | Delta |
|-------|--------|-------|-------|
| `index-*.js` (main bundle) | 470.57 KB (140.70 gzip) | 470.57 KB (140.70 gzip) | **0** |
| `useAutoSave-*.js` (editor) | 836.74 KB (261.93 gzip) | 664.16 KB (210.01 gzip) | **-172.58 KB** |
| `UnifiedDocumentPage-*.js` | 404.27 KB (99.90 gzip) | 114.24 KB (28.12 gzip) | **-290.03 KB** |

New lazy chunks created:

| Chunk | Size | Gzip | Trigger |
|-------|------|------|---------|
| `emoji-picker-react.esm-*.js` | 271.11 KB | 64.11 KB | User clicks project icon |
| `index-*.js` (lowlight) | 172.22 KB | 52.27 KB | Editor chunk loads (background) |
| `DiffViewer-*.js` | 20.03 KB | 6.72 KB | User clicks "View changes" |

**Net reduction in synchronous editor load:** 462.61 KB (172.58 + 290.03)

## Per-Change Table

| Dep | File(s) Modified | Technique | Loading UX | Tradeoff |
|-----|-----------------|-----------|------------|----------|
| emoji-picker-react | `EmojiPicker.tsx` | `React.lazy()` + `Suspense`; only loads when picker opens | 300x350 "Loading..." placeholder on first click | ~200ms delay on first emoji picker open (cached thereafter) |
| lowlight/highlight.js | `Editor.tsx` | Module-level `import('lowlight')` promise; state hook gates extension inclusion | Code blocks work without highlighting until loaded; StarterKit codeBlock as fallback | If lowlight hasn't loaded when user creates code block, no syntax colors until it resolves (~100ms). Editor recreates once with highlighting. In practice, promise resolves before user interacts. |
| diff-match-patch | `ApprovalButton.tsx`, `DiffViewer.tsx`, new `tipTapToPlainText.ts` | `React.lazy()` for DiffViewer; extracted `tipTapToPlainText` to separate file to avoid pulling diff-match-patch statically | "Computing diff..." placeholder in modal | ~50ms delay on first diff view open. `tipTapToPlainText` extracted to its own file so ApprovalButton can import it without triggering the diff-match-patch bundle. |

## Tradeoffs

- **First-interaction delay:** Each lazy-loaded dep has a brief loading moment on first use. All are sub-second on typical connections and cached by the browser thereafter.
- **Editor recreation:** When lowlight loads after the editor has already mounted (rare — usually loads before first render), the TipTap editor recreates. This is visually seamless but discards undo history. In practice, the dynamic import fires at module load time and resolves before the user types.
- **`as Theme` cast in EmojiPicker:** The `Theme` enum from `emoji-picker-react` can't be imported as a value (would defeat lazy-loading), so `"dark" as Theme` is used. The string literal is a known valid enum value.
- **Fallback code blocks:** When lowlight hasn't loaded, code blocks render without syntax highlighting via StarterKit's default codeBlock. Functional but plain. This is a transient state lasting <200ms.

## Deployment & Testing

```bash
pnpm build:shared && pnpm type-check   # Types pass
pnpm test                                # 451 unit tests pass
pnpm dev                                 # Manual verify (see checklist below)
```

### Manual Testing Checklist

**Setup:** `pnpm dev`, open browser, open DevTools Network tab.

1. **Emoji picker:** Navigate to a Project → Properties sidebar → click the colored icon square → emoji picker should open (may show brief loading on first click) → select emoji → verify it appears → click "Remove emoji" → verify it clears
2. **Code blocks:** Open any document → type triple backticks + Enter → type `const x = "hello";` → verify syntax highlighting colors appear → try `/code` slash command → verify language selector works
3. **Diff viewer:** Find or create a document with approval state "changed_since_approved" → click "View changes since last approval" → verify diff modal shows with red/green highlighting
4. **Initial load:** Hard refresh → verify no emoji/lowlight/diff chunks in initial network waterfall

## What to Know for Next Time

- `tipTapToPlainText` now lives in its own file (`web/src/components/tipTapToPlainText.ts`) separate from `DiffViewer.tsx`. A re-export in `DiffViewer.tsx` maintains backwards compatibility for any future consumers.
- The lowlight dynamic import pattern (module-level promise + state hook + conditional extension) could be reused for other heavy TipTap extensions if needed.
- `CodeBlockLowlight` (the TipTap extension wrapper, ~80KB) is still statically imported — only the `lowlight` grammars (~172KB) are lazy. Dynamically importing the extension itself caused TipTap core duplication in a separate chunk.
