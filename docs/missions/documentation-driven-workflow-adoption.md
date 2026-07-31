# Mission — Documentation-Driven Workflow Development Adoption

## Mission

Adopt the Documentation-Driven Workflow Development Standard (DDWD) as an operational delivery rule for Alpha-Tech.

## Objective

Make workflow documentation, in-app guidance, and user self-sufficiency part of the Definition of Done for every material business workflow.

## Approved Standard

Authority document:

- `docs/standards/documentation-driven-workflow-development.md`

Required template:

- `docs/templates/workflow-documentation-template.md`

## Adoption Order

### Phase 1 — Foundation

- Establish the standard.
- Establish the reusable workflow documentation template.
- Require a Documentation section in workflow PRs.
- Use Repair In-App Help Center as the first accepted reference implementation.

### Phase 2 — Active Workflow Adoption

Apply the standard to workflows already under active development, prioritized by operational value:

1. warranty claim
2. receiving and quick receipt
3. sales and reservation
4. input tax and output tax
5. inventory and stock movement
6. partner onboarding and partner store operations

### Phase 3 — Workflow Assistant

Add runtime-aware guidance only where reliable runtime authority exists:

- current stage
- missing prerequisites
- permitted next actions
- blocked action reasons
- contextual help links

Avoid static pseudo-intelligence that could contradict server authority.

### Phase 4 — Runtime Checklist

Add runtime-backed checklists where operational completion depends on evidence, approval, reconciliation, handover, or safety-critical validation.

### Phase 5 — Training and Analytics

Training mode, certification, and help analytics are optional later capabilities. They require separate product, privacy, and data-retention decisions and are not automatically required for each workflow.

## Increment Rule

Every adoption step must be an independently reviewable increment.

One increment may include:

- repository guide
- in-app help projection
- focused contract
- runtime assistant
- checklist

However, unrelated global-shell, analytics, training, or cross-module refactors must be separated.

## Mandatory PR Documentation Section

Every material workflow PR must state:

```text
Documentation
- Business manual:
- User guide:
- In-app help:
- Workflow Assistant:
- Runtime checklist:
- FAQ / troubleshooting:
- Verification evidence:
- Known limitations:
```

For unchanged user behavior, the PR may state `No documentation change required` with a concrete explanation.

## Evidence Boundary

Do not claim:

- runtime PASS from repository inspection
- mobile PASS from desktop evidence
- production PASS from build evidence
- user operability from static text alone

Each authority must be reported separately.

## Initial Reference Evidence

Repair In-App Help Center established the first accepted pattern:

- contextual entry point from the active Repair workspace
- module-owned content and presentation
- search, checklist, status guidance, FAQ, and troubleshooting
- focused contract and build gate
- desktop browser evidence
- global mobile-shell limitation separated into another agenda

## Completion Criteria for This Foundation Increment

- [x] Standard document exists.
- [x] Workflow template exists.
- [x] Adoption mission exists.
- [ ] Draft PR is opened.
- [ ] Repository review confirms paths and content.
- [ ] Merge decision is recorded.

## Out of Scope

- modifying production runtime
- adding database models
- implementing training certification
- implementing documentation analytics
- fixing the global mobile POS shell
- retrofitting every legacy workflow in one increment
