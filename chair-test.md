# Manual Testing Checklist — 2b4 Lazy-load Heavy Deps

**Setup:** `pnpm dev`, open browser, open DevTools Network tab.

## 1. Emoji Picker (ProjectSidebar)

- Navigate to any Project document
- In the right Properties sidebar, find the "Icon" row (below Approvals, above Color)
- Click the colored square icon
- **Verify:** Emoji picker popover opens (may show brief loading skeleton on first click)
- **Verify:** Select an emoji — it appears on the icon
- **Verify:** Click "Remove emoji" — icon reverts to letter
- **Network tab:** On first click, you should see a new chunk load (contains emoji-picker-react)

> **KNOWN ISSUE:** Selecting an emoji currently fails with a 400 Bad Request.
> The `emoji` field is missing from the `updateDocumentSchema` in
> `api/src/routes/documents.ts`. The picker UI loads correctly (lazy-loading
> works), but the API rejects the save.
>
> **Before writing the final report:** Roll back to the original fork (before
> any GFA changes) and test whether emoji save worked there.
>
> - **If it worked on the original fork →** we broke it during type-safety
>   hardening (q6y or later). We need to fix it.
> - **If it was already broken →** pre-existing bug. Call out as extra finding.
>
> **This is NOT caused by the lazy-loading change (2b4).** The onChange path is
> identical before and after.

## 2. Code Block Syntax Highlighting (Editor)

- Open any document (wiki, issue, etc.)
- In the editor body, type triple backticks (```) and press Enter to create a code block
- Type some code, e.g.: `const x = "hello";`
- **Verify:** Syntax highlighting colors appear (keywords in red, strings in blue, etc.)
- Alternative: type `/code` slash command to insert a code block
- **Verify:** Language selector works (click language label, pick "python" or "javascript")
- **Network tab:** A lowlight/highlight chunk may have loaded when you first navigated to the editor page

## 3. Diff Viewer (ApprovalButton)

- Find a document that has been approved and then edited (approval state = "changed_since_approved")
- If none exists: open a document → click "Approve" in the properties panel → edit the content → save
- Look for the amber "View changes since last approval" link
- Click it
- **Verify:** A modal opens showing the diff with red (deletions) and green (additions) highlighting
- **Network tab:** On click, you should see a new chunk load (contains diff-match-patch)

## 4. Full Page Reload Check

- Hard refresh the app (Cmd+Shift+R)
- **Verify:** Initial page loads without errors
- **Verify:** None of the three lazy-loaded deps appear in the initial network waterfall
