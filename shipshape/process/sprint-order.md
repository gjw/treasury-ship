# ShipShape Sprint Order

## Phase 0: Orientation (Monday 3PM deadline)

Sequential — each builds on previous:

1. **treasury-ship-uhe** Orientation: First Contact
   - Repo overview, shared types, data model, request flow trace
   - Output: `docs/orientation-notes.md` Phase 1

2. **treasury-ship-2tu** Orientation: Deep Dive (blocked by uhe)
   - Real-time collab, TypeScript patterns, test infra, build/deploy
   - Output: `docs/orientation-notes.md` Phase 2

3. **treasury-ship-1vw** Orientation: Architecture Assessment (blocked by 2tu)
   - 3 strongest decisions, 3 weakest, onboarding summary, 10x scaling risks
   - Output: `docs/orientation-notes.md` Phase 3

**Parallelism:** None. These are sequential reads by one Trench agent.

## Phase 1: Audit Report (Tuesday 11:59 PM deadline)

All 7 audits can run in parallel slots, but some share infrastructure:

**Slot A — Static analysis (no running app needed):**

4. **treasury-ship-1bx** Audit: Type Safety
5. **treasury-ship-2ns** Audit: Bundle Size

**Slot B — Requires seeded DB + running app:**

6. **treasury-ship-81l** Audit: API Response Time
7. **treasury-ship-1ml** Audit: DB Query Efficiency

**Slot C — Requires running app + browser:**

8. **treasury-ship-jqt** Audit: Test Coverage & Quality
9. **treasury-ship-35k** Audit: Runtime Error Handling
10. **treasury-ship-1sw** Audit: Accessibility

**Parallelism:** Slots A/B/C can run as separate Trench agents if app is up.
Within each slot, tasks are independent.

**After all 7 complete:** Write audit report document. This is the hard gate.

## Phase 2: Implementation (Friday early, Sunday final)

_Not yet broken down._ Tower will create detailed tasks after audit baselines
are known. Priority order will be driven by which categories have the highest
ROI (easiest measurable improvement).

**Likely order (hypothesis before audit):**

- Type Safety — grep-and-fix, high volume, clear metrics
- Bundle Size — tree-shaking, lazy loading, straightforward
- Accessibility — axe violations often have mechanical fixes
- Test Coverage — writing tests is well-scoped
- DB Query Efficiency — N+1 fixes are surgical
- API Response Time — depends on what DB audit finds
- Runtime Error Handling — requires most judgment, save for last

## Deliverables (Sunday deadline)

- [ ] Audit Report
- [ ] Improvement Documentation (per-category)
- [ ] Discovery Write-up (3 things)
- [ ] Demo Video (3-5 min)
- [ ] AI Cost Analysis
- [ ] Deployed Application
- [ ] Social Post
