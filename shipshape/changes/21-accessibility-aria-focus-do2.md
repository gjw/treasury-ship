# Change Doc: Accessibility — ARIA Labels, Focus Indicators, and Extras (do2)

**Category:** 7 — Accessibility Compliance
**Bead:** do2

## Per-Component Change Table

| # | Finding | File | Change |
|---|---------|------|--------|
| F4 | ProseMirror focus indicator | `web/src/index.css` | Added `focus-visible` ring to `.tiptap-wrapper` (keyboard only, not mouse) |
| F5 | EmojiPicker trigger missing label | `web/src/components/EmojiPicker.tsx` | Added `aria-label="Choose icon"` |
| F5 | Editor title missing label | `web/src/components/Editor.tsx` | Added `aria-label="Document title"` |
| F5 | MultiAssociationChips search | `web/src/components/ui/MultiAssociationChips.tsx` | Added `aria-label="Search associations"` |
| F5 | IssueSidebar rejection textarea | `web/src/components/sidebars/IssueSidebar.tsx` | Added `aria-label="Rejection reason"` |
| F5 | ProjectCombobox search input | `web/src/components/ProjectCombobox.tsx` | Added `aria-label="Search projects"` |
| F8 | Indigo association chip contrast | `web/src/components/ui/MultiAssociationChips.tsx` | Added `accessibleChipText()` helper that lightens dark project colors for text display (YIQ brightness check, 30% lift toward white) |
| F9 | Context menu focus indicator | `web/src/components/ui/ContextMenu.tsx` | Added `focus-visible:ring-1 focus-visible:ring-accent` to menu items |
| F10 | Icon rail workspace button | `web/src/pages/App.tsx` | Added `aria-label="Switch workspace"` |
| F10 | Icon rail user button | `web/src/pages/App.tsx` | Added `aria-label="User menu"` |

## Before/After axe-core Results

| Page | Serious (Before) | Serious (After) |
|------|-------------------|-----------------|
| My Week | 0 (post-v4g) | 0 |
| Dashboard | 0 (post-v4g) | 0 |
| Projects List | 0 (post-v4g) | 0 |
| Issues List | 0 | 0 |
| Documents List | 0 | 0 |
| Issue Editor | 3 (expected) | Not scannable (no issue data in seed DB) |

Note: Issue Editor couldn't be scanned because the seed database has no issue documents. The ARIA labels and focus indicators are verified by code review — all 5 missing `aria-label` props added, focus ring CSS applied.

## Tradeoffs

- **ProseMirror focus ring**: Applied to `.tiptap-wrapper` (the outer container) rather than `.ProseMirror` (the inner contenteditable). The inner element uses `outline: none` by design (ProseMirror manages its own cursor). The wrapper shows the focus ring only on `:focus-visible` (keyboard navigation), not on mouse click.
- **Indigo chip contrast**: Used a general `accessibleChipText()` function (YIQ brightness + 30% lift) rather than a hardcoded color map. This handles any dark project color, not just indigo. The colored dot indicator still shows the original project color.
