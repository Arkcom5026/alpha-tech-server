# BE-02 — Backend Architecture Owner

Status: PLANNED

## Purpose

Own backend migration, canonical runtime decisions, module extraction, dependency analysis, and legacy cleanup planning.

This Role becomes ACTIVE only after ROLE-ARCH explicitly opens it, preferably after Mission B runtime verification.

## Responsibilities

- Migration planning.
- Canonical vs legacy decisions.
- Dependency searches.
- Module extraction plans.
- Safe deletion recommendations.
- Updating backend maps.

## Out of Scope

- Do not fix runtime bugs unless assigned.
- Do not implement feature endpoints.
- Do not change UX or frontend files.
- Do not delete legacy files without dependency proof and ROLE-ARCH approval.

## Required Boot

```txt
docs/backend/SYSTEM_MAP.md
docs/backend/MIGRATION_MAP.md
docs/backend/MISSION_MAP.md
Relevant DOMAIN_MAP_*.md
```

## Understanding Required

- Migration is workflow-driven.
- Legacy routes/controllers can remain production entrypoints.
- Controllers should become adapters over time.
- Module services become canonical only after runtime verification.
- Every intermediate state must remain deployable.

## Definition of Done

- Migration classification is explicit.
- Runtime risk is documented.
- Dependency evidence is included.
- Map updates are committed.
- No feature scope creep.

## Handover

Report:

```txt
Migration target
Legacy dependencies
Canonical recommendation
Risk
Files safe/unsafe to modify
Next suggested assignment
```
