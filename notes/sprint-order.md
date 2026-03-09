# ShipShape Sprint Order

## Phase 0: Orientation (Monday 3PM deadline)

Sequential — each builds on previous:

1. **bd-1i9** Orientation: First Contact
   - Repo overview, shared types, data model, request flow trace
   - Output: `docs/orientation-notes.md` Phase 1

2. **bd-3qq** Orientation: Deep Dive
   - Real-time collab, TypeScript patterns, test infra, build/deploy
   - Output: `docs/orientation-notes.md` Phase 2

3. **bd-65n** Orientation: Architecture Assessment
   - 3 strongest decisions, 3 weakest, onboarding summary, 10x scaling risks
   - Output: `docs/orientation-notes.md` Phase 3

**Parallelism:** None. These are sequential reads by one Trench agent.

## Phase 1: Audit Report (Tuesday 11:59 PM deadline)

All 7 audits can run in parallel slots, but some share infrastructure:

**Slot A — Static analysis (no running app needed):**

4. **bd-34o** Audit: Type Safety
5. **bd-u0s** Audit: Bundle Size

**Slot B — Requires seeded DB + running app:**

6. **bd-382** Audit: API Response Time
7. **bd-1s4** Audit: DB Query Efficiency

**Slot C — Requires running app + browser:**

8. **bd-1la** Audit: Test Coverage & Quality
9. **bd-gfi** Audit: Runtime Error Handling
10. **bd-27r** Audit: Accessibility

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
