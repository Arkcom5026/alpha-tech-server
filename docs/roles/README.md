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
2. Read current Mission / Blackboard / Assignment
3. Read required system/runtime/domain/migration maps
4. Confirm scope and forbidden areas
5. Execute smallest safe patch
6. Produce verification or handover report
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
