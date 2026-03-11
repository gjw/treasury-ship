# Manual Testing Checklist: Runtime Error Handling

**For:** Chair (manual browser testing)
**Companion to:** `audit/06-runtime-error-handling.md`
**Date:** 2026-03-10

Report results back to Trench. Use the **Result** column — write what you observed.

---

## Setup

1. Open the app in Chrome
2. Open DevTools (F12) → Console tab
3. Clear console before each test
4. Keep a second browser/incognito window ready for concurrent edit tests

---

## Test 1: Console Errors During Normal Usage

**Goal:** Count baseline console errors/warnings during typical navigation.

| Step | Action | What to Record |
|------|--------|----------------|
| 1 | Clear console. Navigate to Dashboard. | Error count: ___ Warning count: ___ |
| 2 | Navigate to Issues list. | Error count: ___ Warning count: ___ |
| 3 | Open any issue document. Wait for editor to load. | Error count: ___ Warning count: ___ |
| 4 | Type a few sentences in the editor. | Error count: ___ Warning count: ___ |
| 5 | Navigate to Projects. Open a project. | Error count: ___ Warning count: ___ |
| 6 | Navigate to My Week. | Error count: ___ Warning count: ___ |
| 7 | Navigate to Team → Directory. | Error count: ___ Warning count: ___ |
| 8 | Navigate to Settings. | Error count: ___ Warning count: ___ |

**Total errors across normal navigation:** ___
**Total warnings across normal navigation:** ___
**Notable error messages (copy-paste any that look real):**

```
(paste here)
```

---

## Test 2: Network Disconnect During Collaborative Editing

**Goal:** Determine if data survives a network disconnect and if UI recovers.

| Step | Action | What to Record |
|------|--------|----------------|
| 1 | Open a document in the editor. Type "BEFORE DISCONNECT - " and some text. | Confirm text appears: yes/no |
| 2 | Open DevTools → Network tab. Click "Offline" checkbox (or throttle to Offline). | What happened to the editor UI? Any indicator shown? Describe: ___ |
| 3 | While offline, type "OFFLINE EDIT - " and more text. | Does the editor accept input? yes/no |
| 4 | Wait 10 seconds. Uncheck "Offline" to reconnect. | What happens? Does a sync indicator appear? Describe: ___ |
| 5 | Refresh the page. | Is the "BEFORE DISCONNECT" text still there? yes/no |
| 6 | Is the "OFFLINE EDIT" text still there? | yes/no |
| 7 | Check console for errors during this whole flow. | Error count: ___ Copy notable ones: ___ |

**Network disconnect recovery verdict:** Pass / Partial / Fail

---

## Test 3: Network Disconnect During Concurrent Editing

**Goal:** Two users editing same document, one disconnects.

| Step | Action | What to Record |
|------|--------|----------------|
| 1 | Open the same document in two browser windows (Window A and Window B). | Both show the document? yes/no |
| 2 | In Window A, type "USER-A-EDIT" at the top. | Does it appear in Window B? yes/no. How fast? ___ |
| 3 | Set Window B to Offline (DevTools → Network → Offline). | Any indicator in Window B? Describe: ___ |
| 4 | In Window A (still online), type "A-WHILE-B-OFFLINE". | — |
| 5 | In Window B (offline), type "B-WHILE-OFFLINE". | Does Window B accept input? yes/no |
| 6 | Reconnect Window B. | What happens? Do both edits appear in both windows? Describe: ___ |
| 7 | Refresh both windows. Verify all text present. | All edits preserved? yes/no. Anything lost? ___ |

---

## Test 4: Malformed Input

**Goal:** Test how the app handles weird input.

### 4a: Empty Form Submission

| Step | Action | What to Record |
|------|--------|----------------|
| 1 | Go to My Week. Click "Create Plan" (or equivalent create action). | Does it submit? What happens? ___ |
| 2 | Try to create a new document with empty title (if possible). | Result: ___ |
| 3 | Try to submit an empty standup. | Result: ___ |

### 4b: Extremely Long Text

| Step | Action | What to Record |
|------|--------|----------------|
| 1 | Open a document editor. Paste 50,000 characters of text (generate with: `"x".repeat(50000)` in console, then paste). | Does the editor handle it? Any lag? Describe: ___ |
| 2 | Save/navigate away and back. | Content preserved? yes/no |
| 3 | Check console for errors. | Error count: ___ |

### 4c: Special Characters / HTML Injection

| Step | Action | What to Record |
|------|--------|----------------|
| 1 | In a document title field, type: `<script>alert('xss')</script>` | Does the script execute? (Should NOT) yes/no |
| 2 | In the editor body, type: `<img src=x onerror=alert(1)>` | Does it render as HTML or as plain text? ___ |
| 3 | In a comment field, type: `"><svg onload=alert(1)>` | Result: ___ |
| 4 | In a document title, type: `'; DROP TABLE documents; --` | Result (should just be text): ___ |

---

## Test 5: Throttled Network (3G Simulation)

**Goal:** Find spinners that hang, silent failures, missing loading states.

| Step | Action | What to Record |
|------|--------|----------------|
| 1 | Open DevTools → Network → Throttle → "Slow 3G". | — |
| 2 | Navigate to Dashboard. | Load time: ___s. Any missing loading indicators? Describe: ___ |
| 3 | Navigate to Issues list. | Load time: ___s. Does list show loading state? yes/no |
| 4 | Open a document. | Load time: ___s. Editor loading indicator? yes/no. Any flash of empty content? ___ |
| 5 | Type in the editor on 3G. | Any lag in display? Does save indicator work? ___ |
| 6 | Navigate to Projects. | Any component that shows empty then populates (flash of empty)? ___ |
| 7 | Navigate to Team → Allocation. | Load time: ___s. This page is query-heavy (18+ queries). Does it show loading? ___ |
| 8 | Try creating a new standup on 3G. | Button shows loading? How long? Does it succeed? ___ |
| 9 | Set throttle back to "No throttling". | — |

**Spinners that hung:** ___
**Silent failures observed:** ___
**Missing loading states:** ___

---

## Test 6: Server Log Errors

**Goal:** Check for unhandled errors on the server side during all the above tests.

| Step | Action | What to Record |
|------|--------|----------------|
| 1 | Before starting tests, tail the API server logs: `pnpm dev:api` output or check terminal. | — |
| 2 | Run through Tests 1-5 above while watching server output. | — |
| 3 | After all tests, count how many `Error:` or stack traces appeared in server logs. | Error count: ___ |
| 4 | Copy any notable server errors. | Paste below: |

```
(paste server errors here)
```

---

## Test 7: Session Timeout Edge Cases

**Goal:** Verify session timeout behavior under stress.

| Step | Action | What to Record |
|------|--------|----------------|
| 1 | Log in. Open a document. Start editing. | — |
| 2 | Close your laptop lid (sleep) for 2 minutes, then reopen. | Does the session still work? Does editor reconnect? Describe: ___ |
| 3 | Leave the app idle for 15+ minutes (or temporarily shorten the session timeout). | Does the timeout modal appear? Does it count down? ___ |
| 4 | While the timeout modal is showing, go offline (DevTools → Offline). Click "Stay Logged In". | What happens? Does it force logout? Error shown? ___ |

---

## Test 8: Specific Silent Failure Reproduction

These are bugs I found in static analysis. Confirm they reproduce.

### 8a: MyWeekPage Create Failure (S1 from audit)

| Step | Action | What to Record |
|------|--------|----------------|
| 1 | Go to My Week. | — |
| 2 | Open DevTools → Network tab. | — |
| 3 | Right-click the "Create Plan" API call (when you click it) and select "Block request URL". Or: set DevTools to Offline right as you click. | — |
| 4 | Click "Create Plan". | What happens? Does button reset? Any error shown? ___ |

### 8b: WeekReconciliation Move Failure (S2 from audit)

| Step | Action | What to Record |
|------|--------|----------------|
| 1 | Open a sprint/week that has issues to reconcile. | — |
| 2 | Open DevTools → Network. Block the PATCH/POST endpoint or go Offline. | — |
| 3 | Try to move an issue to next sprint. | What happens? Error shown? Button state? ___ |

### 8c: Document Load Failure (S3 from audit)

| Step | Action | What to Record |
|------|--------|----------------|
| 1 | Go Offline in DevTools. | — |
| 2 | Click on any document link. | What shows? Loading spinner forever? Error page? White screen? ___ |
| 3 | Go back Online. | Does it auto-recover? Or do you need to refresh? ___ |

---

## Summary (Fill In After All Tests)

| Metric | Your Baseline |
|--------|---------------|
| Console errors during normal usage | ___ |
| Unhandled promise rejections (server) | ___ |
| Network disconnect recovery | Pass / Partial / Fail |
| Missing error boundaries | (confirmed from static: 6 routes + editor init) |
| Silent failures identified | List confirmed + any new ones: |

**Notes / Surprises:**

```
(anything unexpected)
```
