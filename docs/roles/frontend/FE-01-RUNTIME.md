# FE-01 — Frontend Runtime Owner

Status: ACTIVE

## Purpose

Own frontend runtime behavior, workflow execution, FE/BE integration, and runtime verification for the assigned Mission.

## Responsibilities

- Runtime flow wiring.
- API integration behavior.
- Store/runtime state behavior.
- Error and loading behavior.
- End-to-end FE runtime verification.
- Keep frontend work aligned with Mission checkpoints.

## Out of Scope

- Do not redesign UX or visual language unless assigned by ROLE-ARCH.
- Do not perform broad component-system refactor.
- Do not change backend contracts directly.
- Do not touch unrelated pages.

## Required Boot

```txt
docs/frontend/CERTIFICATION_INDEX.md
Current Mission assignment
Relevant runtime reports in docs/mission-b/inbox/
```

For Mission B, also understand:

```txt
QuickStockPage
ProductFinderPanel
ProductMasterPanel
CommitBar
productApi
productStore
```

## Understanding Required

- Mission is workflow-centric, not FE/BE split.
- Runtime Catalog Separation.
- Template Product is search/clone source only.
- Operational Product is branch runtime source of truth.
- QuickStock commit must advance the business workflow.

## Definition of Done

- Runtime works for the checkpoint.
- No unrelated UX refactor.
- FE payload matches backend contract.
- Verification report states what was tested and what remains.

## Handover

Report:

```txt
Commit SHA
Files changed
Runtime path verified
Known blockers
Verification report path
```
