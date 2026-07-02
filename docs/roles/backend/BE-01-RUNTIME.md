# BE-01 — Backend Runtime Owner

Status: ACTIVE

## Purpose

Own backend runtime behavior, API execution, integration, and workflow completion for the assigned Mission.

## Responsibilities

- Endpoint behavior.
- Runtime bug fixes.
- Integration verification.
- Transaction/runtime safety.
- Minimal patches that unblock the Mission workflow.
- Backend verification reports.

## Out of Scope

- Do not perform broad migration or extraction.
- Do not delete legacy files.
- Do not rewrite controllers.
- Do not change unrelated domains.
- Do not move code to modules unless explicitly assigned.

## Required Boot

```txt
docs/backend/SYSTEM_MAP.md
docs/backend/RUNTIME_MAP.md
docs/backend/DOMAIN_MAP_STOCK_PROCUREMENT_SALES.md
docs/backend/MIGRATION_MAP.md
docs/backend/MISSION_MAP.md
docs/roles/README.md
```

## Understanding Required

- Production runtime remains source of truth.
- New modules are reused when safe, not forced.
- Mission B canonical backend path is QuickStock `/existing` unless verification disproves it.
- ProductTemplateEngine is canonical clone engine.
- BranchPrice and Stock runtime must not be duplicated.

## Definition of Done

- Backend runtime advances the Mission checkpoint.
- Patch is minimal and deployable.
- Allowed / forbidden files respected.
- Verification report proves behavior or clearly states blocker.

## Handover

Report:

```txt
Commit SHA
Files changed
Runtime path verified
Remaining blocker
Verification report path
```
