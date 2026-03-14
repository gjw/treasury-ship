# Bugs Found During ShipShape Audit

Bugs discovered during the audit and implementation phases. These are pre-existing issues in the Ship codebase, not introduced by our changes. Documented for completeness.

## B1: crypto.randomUUID() fails on non-HTTPS deployments

**Severity:** Medium
**Location:** `web/src/components/editor/CommentMark.ts:99`
**Status:** Mitigated (deploy with HTTPS)

`crypto.randomUUID()` is only available in secure contexts (HTTPS or localhost). Deploying over plain HTTP to a public IP causes `Uncaught TypeError: crypto.randomUUID is not a function` when clicking the Comment button. Fix: use a fallback UUID generator, or always deploy with HTTPS.

## B2: Comment tooltip appears on non-selectable template content

**Severity:** Low
**Location:** `web/src/components/Editor.tsx:1007-1013`
**Status:** Open (pre-existing)

The Comment floating menu appears when hovering over planned item templates (e.g., "PLANNED #1" blocks in weekly retros), but text inside these template nodes cannot be selected. The `addComment` command requires a text selection (`editor.state.selection.empty` check at `CommentMark.ts:98`), so clicking Comment is always a noop on these items. The tooltip should not appear when selection is impossible.

## B3: Inline comment cancel doesn't clear highlight

**Severity:** Low
**Location:** `inline-comments.spec.ts:118` (test documents the bug)
**Status:** Open (pre-existing, caught by E2E test)

Canceling an inline comment leaves the highlight styling on the text. The E2E test for this behavior fails. The comment-cancel handler doesn't call `unsetComment()` to remove the mark.

## B4: Yjs persistDocument race condition on disconnect

**Severity:** Medium
**Location:** `api/src/collaboration/index.ts` (persist on WebSocket close)
**Status:** Partially mitigated (added .catch + retry in bead 325)
**Bead:** treasury-ship-1y2

The collaboration server calls `persistDocument()` on WebSocket close, but the Y.Doc may already be cleaned up by the time the async persist completes. Our error handling fix (bead 325) added .catch() with retry and logging so failures are no longer silent, but the underlying race condition between cleanup and persistence remains. Under high disconnect churn, last edits could still be lost.

## B5: Flaky E2E test — Yjs debounce race in retro edits

**Severity:** Low
**Location:** `e2e/tests/my-week-stale-data.spec.ts:63`
**Status:** Open (documented in bead p33 change doc)

The "retro edits visible on /my-week after nav" test was partially fixed (test targeted wrong element), but the underlying Yjs fire-and-forget persist timing means edits may not be persisted to the database before navigation. The test uses a workaround (full page reload to bypass cache) but the app-level race remains.
