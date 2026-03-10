# Accessibility Compliance Audit

**Date:** 2026-03-10
**Auditor:** Trench (treasury-ship-1sw)
**Tools:** axe-core 4.11.1 (via @axe-core/playwright), Playwright 1.57, source analysis
**WCAG Target:** 2.1 AA / Section 508
**Scope:** 14 major pages, all document types

---

## Executive Summary

Ship has a **solid accessibility foundation** — proper landmark regions, ARIA tree widgets,
skip-to-content link, labeled navigation, and visible focus indicators. The single
automated violation category is **color contrast**, affecting 5 of 14 pages (45 serious
instances, 0 critical). Source analysis reveals additional opportunities around ARIA
labeling and focus management in specific components.

---

## 1. Automated Scanner Results (axe-core)

**Methodology:** axe-core 4.11.1 injected via Playwright into each page after login +
2-second dynamic content wait. Tags: wcag2a, wcag2aa, wcag21a, wcag21aa, section508.

| Page | Violations | Critical | Serious | Moderate | Minor | Passes |
|------|-----------|----------|---------|----------|-------|--------|
| Login | 0 | 0 | 0 | 0 | 0 | 23 |
| My Week | 1 | 0 | 15 | 0 | 0 | 20 |
| Dashboard | 1 | 0 | 14 | 0 | 0 | 20 |
| Issues List | 0 | 0 | 0 | 0 | 0 | 21 |
| Documents List | 0 | 0 | 0 | 0 | 0 | 23 |
| Projects List | 1 | 0 | 12 | 0 | 0 | 21 |
| Programs List | 0 | 0 | 0 | 0 | 0 | 20 |
| Team Allocation | 1 | 0 | 1 | 0 | 0 | 20 |
| Team Directory | 0 | 0 | 0 | 0 | 0 | 20 |
| Settings | 0 | 0 | 0 | 0 | 0 | 20 |
| Issue Editor | 1 | 0 | 3 | 0 | 0 | 26 |
| Wiki Editor | 0 | 0 | 0 | 0 | 0 | 23 |
| Project Editor | 0 | 0 | 0 | 0 | 0 | 23 |
| Sprint Editor | 0 | 0 | 0 | 0 | 0 | 23 |

**Totals: 0 Critical, 45 Serious, 0 Moderate, 0 Minor**

All 45 serious violations are the **same rule: `color-contrast`** (WCAG 2.1 AA 1.4.3).
9 of 14 pages passed with zero violations.

---

## 2. Color Contrast Failures (Detail)

Every automated violation is a contrast ratio below the 4.5:1 WCAG AA threshold. Three
distinct patterns account for all 45 failures:

### Pattern A: `text-accent` on dark/accent-tinted backgrounds

| Foreground | Background | Ratio | Required | Affected Pages |
|-----------|-----------|-------|----------|---------------|
| #005ea2 (accent) | #0a1d2b (bg-accent/20) | 2.55:1 | 4.5:1 | My Week, Projects List |
| #005ea2 | #0c151c (bg-accent/10) | 2.74:1 | 4.5:1 | Dashboard |
| #005ea2 | #1a1a1a (bg) | 2.58:1 | 4.5:1 | Dashboard |
| #005ea2 | #0d0d0d (bg) | 2.89:1 | 4.5:1 | Team Allocation |

**Impact:** 16 elements. Accent-colored text (#005ea2) on dark backgrounds consistently
fails. The accent blue is too dark for the dark theme's backgrounds.

**Affected components:** Sprint badges (`bg-accent/20 text-accent`), active tab buttons,
current-day highlights, project health percentages.

### Pattern B: `text-muted/50` on dark backgrounds

| Foreground | Background | Ratio | Required | Affected Pages |
|-----------|-----------|-------|----------|---------------|
| #4c4c4c (muted/50) | #0d0d0d (bg) | 2.26:1 | 4.5:1 | My Week, Dashboard |
| #585858 (muted/60) | #0d0d0d (bg) | 2.73:1 | 4.5:1 | Dashboard |

**Impact:** 25 elements. Numbered list markers, day-of-week labels, section headings
using reduced-opacity muted text. The `text-muted/50` and `text-muted/60` opacity
variants are far below the 4.5:1 threshold.

**Affected components:** Priority list numbering, weekly calendar day labels,
section headings ("Your Focus This Week").

### Pattern C: `text-muted` on elevated surfaces

| Foreground | Background | Ratio | Required | Affected Pages |
|-----------|-----------|-------|----------|---------------|
| #8a8a8a (muted) | #333333 (bg-muted/30) | 3.65:1 | 4.5:1 | Projects List |
| #8a8a8a (muted) | #262626 (bg-border) | 4.38:1 | 4.5:1 | Issue Editor |

**Impact:** 4 elements. Filter count badges and property selector buttons where
`text-muted` sits on slightly elevated background surfaces.

### Pattern D: Accent links on tinted backgrounds

| Foreground | Background | Ratio | Required | Affected Pages |
|-----------|-----------|-------|----------|---------------|
| #6366f1 (indigo) | #18182a (bg) | 3.90:1 | 4.5:1 | Issue Editor |

**Impact:** 1 element. Association chip links using indigo color on dark tinted background.

### Severity Ranking

1. **Pattern B** (25 elements, ratio 2.26:1) — Most widespread, worst ratios
2. **Pattern A** (16 elements, ratio 2.55–2.89:1) — Core UI accent color fundamentally too dark
3. **Pattern C** (4 elements, ratio 3.65–4.38:1) — Near-miss, easiest to fix
4. **Pattern D** (1 element, ratio 3.90:1) — Isolated to association chips

---

## 3. Keyboard Navigation

**Methodology:** Playwright focus enumeration + Tab-order analysis on Documents List page.
Manual verification of skip link, landmark navigation, and tree widget keyboard support.

### Assessment: **Partial**

**Working well:**

- **Skip to main content** link present and functional (`<a href="#main-content">`)
- **Tab order is logical**: Skip link → Banner → Nav buttons → Sidebar → Main content
- **All 48 visible interactive elements** are keyboard-focusable (0 hidden/trapped)
- **Focus indicators visible**: 2px solid accent (#005ea2) outline on buttons; blue ring
  on links. Tested on navigation, sidebar, and content area elements.
- **Tree widgets** use proper `role="tree"` / `role="treeitem"` with Expand/Collapse
  buttons
- **Tabs** use `role="tablist"` / `role="tab"` with selection state
- **Combobox** pattern uses proper `role="combobox"` with `aria-expanded`, `aria-controls`,
  `aria-haspopup`
- **Dialog** focus trapping works (tested Action Items dialog — focus moved to Close button)

**Issues found:**

- **Icon Rail buttons lack text for screen readers**: Workspace switcher button shows
  only "S" (first letter of workspace name), user avatar button shows only "D" — no
  `aria-label` explaining their purpose.
- **`main` element has `tabindex="-1"`**: This is intentional for skip-link target but
  means main region receives focus on skip-link click and shows no visible indicator
  (outline removed in CSS). Users may lose track of focus position after using skip link.
- **21 `outline: none` rules** in compiled CSS. Most are on non-interactive containers
  (section, nav, overflow wrappers, ProseMirror editor) which is acceptable. A few are
  on interactive elements that provide `focus:ring` replacements
  (SessionTimeoutModal, KanbanBoard, SelectableList).
- **ProseMirror editor** removes outline globally (index.css:66) — the rich text editing
  area has no visible focus indicator when it receives focus via Tab.

---

## 4. Source-Level ARIA Audit

**Methodology:** Grep and manual code review of all components in `web/src/components/`
and `web/src/pages/`.

### Landmarks (Good)

- `<nav role="navigation" aria-label="Primary navigation">` — `App.tsx:299`
- `<main id="main-content" role="main" tabIndex={-1}>` — `App.tsx:541`
- `<aside aria-label="Document properties">` — `App.tsx:549`
- `<aside>` (contextual sidebar) with `aria-label="Document list"` — `App.tsx:421`
- `<ul role="tree" aria-label="Document context">` — `ContextTreeNav.tsx:108`

### ARIA Labels on Interactive Elements (Good)

- Navigation buttons: Dashboard, Docs, Programs, Projects, Teams, Settings — all labeled
- Tree items: Expand, Document actions — all labeled
- Form controls in IssueSidebar: `aria-label="Status"`, `aria-label="Priority"`,
  `aria-label="Estimate in hours"` — properly labeled
- View mode group: `aria-label="View mode"` with "List view" / "Tree view" buttons
- PropertyRow info buttons: `aria-label="More info about ${label}"` — dynamically labeled

### Missing ARIA Labels (Findings)

| Component | Location | Issue | Severity |
|-----------|----------|-------|----------|
| EmojiPicker | `EmojiPicker.tsx:56-62` | Trigger button shows only emoji character, no `aria-label` | Medium |
| Editor title | `Editor.tsx:927` | Title `<textarea>` has placeholder but no `aria-label` or associated `<label>` | Medium |
| Search inputs in dropdowns | `MultiAssociationChips.tsx:172-179` | Search `<input>` inside dropdown has no `aria-label`, only placeholder | Medium |
| Rejection reason | `IssueSidebar.tsx:313-319` | Textarea for rejection reason has no label element or `aria-label` | Medium |
| ProjectCombobox search | `ProjectCombobox.tsx:197` | Search input uses `focus:outline-none` with no `aria-label` | Low |

### Missing `<img>` Alt Text

No violations found. `ResizableImage.tsx` uses `alt={node.attrs.alt || ''}` and
`ImageUpload.tsx` sets `alt: file.name` on upload. Login page logo has `alt="Ship"`.

### Focus Management Concerns

| Component | Location | Issue | Severity |
|-----------|----------|-------|----------|
| ContextMenu items | `ContextMenu.tsx:200` | `outline-none focus:bg-border/50` — relies solely on background color change for focus, which may be insufficient for low-vision users | Medium |
| Toast close button | `Toast.tsx:86` | No visible focus styles defined | Low |
| Combobox search | `Combobox.tsx:90` | `focus:outline-none` on search input, relies on parent ring | Low |

---

## 5. Baseline Metrics Summary

| Metric | Baseline |
|--------|----------|
| **axe-core violations (unique rules)** | 1 rule (color-contrast) |
| **Total Critical/Serious violations** | 0 critical / 45 serious (across 5 pages) |
| **Pages with zero violations** | 9 of 14 (64%) |
| **Keyboard navigation completeness** | **Partial** — all elements reachable, skip link works, but editor area lacks focus indicator and some icon buttons lack descriptive labels |
| **Color contrast failures** | 45 elements failing WCAG 2.1 AA 4.5:1 minimum |
| **Missing ARIA labels or roles** | 5 components with missing/weak labels (EmojiPicker, Editor title, MultiAssociationChips search, IssueSidebar rejection textarea, ProjectCombobox search) |
| **Landmark structure** | Complete — nav, main, aside (×2) all present with aria-labels |
| **Focus indicators** | Present on most elements (2px accent outline); missing on ProseMirror editor and context menu items |
| **Skip-to-content link** | Present and functional |
| **Screen reader structure** | Good — headings, tree roles, tab roles, combobox pattern all correct |

---

## 6. Findings Ranked by Severity

| # | Finding | Impact | Elements | Pages |
|---|---------|--------|----------|-------|
| 1 | `text-muted/50` contrast failure (2.26:1) | Serious | 25 | My Week, Dashboard |
| 2 | `text-accent` on dark backgrounds (2.55–2.89:1) | Serious | 16 | My Week, Dashboard, Projects, Team Allocation |
| 3 | `text-muted` on elevated surfaces (3.65–4.38:1) | Serious | 4 | Projects List, Issue Editor |
| 4 | ProseMirror editor has no focus indicator | Medium | 1 | All editor pages |
| 5 | Editor title textarea missing aria-label | Medium | 1 | All editor pages |
| 6 | EmojiPicker trigger missing aria-label | Medium | 1 | All editor pages |
| 7 | Search inputs in dropdowns missing aria-label | Medium | ~3 | Issue Editor, various |
| 8 | Indigo association chip links (3.90:1) | Medium | 1 | Issue Editor |
| 9 | ContextMenu focus indicator is background-only | Low | N/A | Context menus app-wide |
| 10 | Icon rail buttons ("S", "D") lack descriptive labels | Low | 2 | All pages |

---

## 7. Improvement Target

Per the audit AC:

> Achieve a Lighthouse accessibility score improvement of 10+ points on the lowest-scoring
> page, or fix all Critical/Serious violations on the 3 most important pages.

**Recommended path:** Fix all Critical/Serious violations (all are color-contrast) on:

1. **My Week** (15 serious) — most-visited page
2. **Dashboard** (14 serious) — second most-visited
3. **Projects List** (12 serious) — core workflow page

This requires addressing only two CSS patterns:

- Replace `text-muted/50` and `text-muted/60` with a lighter muted variant (≥ #737373 on #0d0d0d = 4.57:1)
- Replace `text-accent` (#005ea2) with a lighter accent variant when on dark backgrounds (≥ #2e8bc0 on #0d0d0d ≈ 4.5:1), or lighten accent-tinted backgrounds

---

## Appendix: Raw Data

- Full axe-core results: `audit/07-a11y-axe-results.json`
- Contrast failure detail: `audit/07-a11y-contrast-details.json`
- Audit script: `scripts/a11y-audit.ts`
- Contrast detail script: `scripts/a11y-contrast-detail.ts`
