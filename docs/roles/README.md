# P1 Role Boot Index

Status: ACTIVE BASELINE
Purpose: Prepare Responsibility Owner structure for future FE/BE Tasks.

P1 work is organized by Responsibility, not by temporary technical tasks.

A Task may enter as one Role for one Mission or checkpoint. The Role defines what the Task owns, what it must read, what it may change, and what it must not touch.

## Core Operating Rule

```txt
Mission Director = Human
ROLE-ARCH = Mission Architect / Orchestrator
Role Owners = focused responsibility teams
Assignments = smallest safe patches that advance the Mission workflow
```

## Current Role Structure

```txt
ROLE-ARCH

frontend/
  FE-01-RUNTIME.md
  FE-02-UX.md
  FE-03-COMPONENT.md
  FE-04-ROUTING.md
  FE-05-STATE.md
  FE-06-PERFORMANCE.md
  FE-07-TESTING.md

backend/
  BE-01-RUNTIME.md
  BE-02-ARCHITECTURE.md
  BE-03-PRODUCT.md
  BE-04-INVENTORY.md
  BE-05-PROCUREMENT.md
  BE-06-SALES.md
  BE-07-FINANCE.md
  BE-08-TESTING.md
```

## Role Status Legend

```txt
ACTIVE   = may receive assignments now
PLANNED  = structure prepared, not active until ROLE-ARCH opens it
LOCKED   = must not receive assignments
RETIRED  = no longer used
```

## Current Active Roles

```txt
ROLE-ARCH
FE-01 Runtime Owner
FE-02 UX Owner
BE-01 Runtime Owner
```

## Planned Roles

```txt
BE-02 Architecture Owner after Mission B runtime verification
Additional FE/BE domain owners after their maps and boot documents are ready
```

## Universal Role Boot Rule

Every Role must boot before changing code:

```txt
1. Read assigned Role file
2. Read current Mission / Blackboard
3. Read required system/runtime/domain/migration/mission maps
4. Identify assigned Role Workspace
5. Read Assignment from the Role Workspace
6. Confirm scope and forbidden areas
7. Execute smallest safe patch
8. Produce verification or handover report in the Role Workspace inbox
```

## Role Workspace Rule

Each Role has its own workspace inside each Mission.

Preferred structure:

```txt
docs/<mission>/
  assignments/
    ROLE-ID/
      ASSIGNMENT-###.md
  inbox/
    ROLE-ID/
      VERIFY-###.md
      REPORT-###.md
      HANDOVER-###.md
```

Example:

```txt
docs/mission-b/assignments/FE-01/ASSIGNMENT-018.md
docs/mission-b/inbox/FE-01/FLOW-DESIGN-001.md
```

Rules:

- Assignments must state the receiving Role.
- Reports must be written to the same Role workspace unless ROLE-ARCH says otherwise.
- A Role must not write reports into another Role workspace.
- Cross-role handover must name the next Role explicitly.
- Legacy shared paths may remain for historical reports, but new assignments should prefer Role workspace paths.

## P1 Boot Sequence

Use this complete boot sequence for new Tasks:

```txt
1. Blueprint / current Mission state
2. Mission Blackboard
3. SYSTEM_MAP
4. RUNTIME_MAP
5. DOMAIN_MAP when relevant
6. MIGRATION_MAP when backend architecture or cleanup is involved
7. MISSION_MAP
8. Role Boot file
9. Role Workspace
10. Assignment
11. Verification target
12. Begin work
```

## Universal Handover Rule

A Role does not only hand over code. It hands over understanding:

```txt
Runtime understanding
Architecture understanding
Mission status
Files changed
Known risks
Next recommended owner
Verification evidence
```
