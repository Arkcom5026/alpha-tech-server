# Workflow Documentation Template

Use this template for every material Alpha-Tech workflow.

## 1. Overview

- Workflow name:
- Owning module:
- Business objective:
- Primary users:
- Entry points:
- Out of scope:

## 2. Actors and Responsibilities

| Actor | Responsibility | Permission Boundary |
|---|---|---|
|  |  |  |

## 3. Preconditions

- Required identity and role:
- Required branch/shop/tenant context:
- Required master data:
- Required prior workflow state:

## 4. Business Workflow

```text
Start
→ Step
→ Decision
→ Outcome
```

### Main path

1. 
2. 
3. 

### Alternative paths

- 

### Exception and recovery paths

- Interrupted session:
- Duplicate prevention:
- Invalid state:
- Permission failure:
- External dependency failure:

## 5. Business Rules

- 

## 6. Lifecycle and Statuses

| Status | Thai meaning | Allowed next actions | Terminal? |
|---|---|---|---|
|  |  |  |  |

## 7. User Guide

### Screen / entry point

- Purpose:
- Fields:
- Required evidence:
- Available actions:
- Expected result:
- Recommended next step:

## 8. In-App Help Projection

- Help entry point:
- Context mapping:
- Search keywords:
- Steps shown:
- Checklist shown:
- Status guidance:
- FAQ:
- Troubleshooting:

## 9. Workflow Assistant

Mark one:

- [ ] Implemented
- [ ] Not applicable — justified below
- [ ] Follow-up increment required

Runtime guidance:

- Current stage:
- Completed prerequisites:
- Missing prerequisites:
- Permitted next actions:
- Blocked actions and reasons:

Justification / follow-up:

## 10. Runtime Checklist

Mark one:

- [ ] Implemented
- [ ] Not applicable — justified below
- [ ] Follow-up increment required

Checklist items and their runtime authority:

| Item | Runtime source | Blocking or advisory |
|---|---|---|
|  |  |  |

## 11. FAQ and Troubleshooting

### Frequently asked questions

- **Question:**
  - Answer:

### Troubleshooting

| Symptom | Likely cause | User action | Escalation boundary |
|---|---|---|---|
|  |  |  |  |

## 12. Technical Reference

- Domain ownership:
- API contracts:
- Database models:
- Events / audit:
- Permission policy:
- Error codes:

## 13. Verification Evidence

| Gate | Command / Evidence | Result | Authority |
|---|---|---|---|
| Repository |  |  |  |
| Focused test |  |  |  |
| Build |  |  |  |
| Runtime |  |  |  |
| Operational |  |  |  |
| Production |  |  |  |

## 14. Known Limitations

- 

## 15. Follow-Up Increments

- 

## 16. Definition of Done

### Business and Runtime

- [ ] Business workflow is explicit.
- [ ] Actors and permission boundaries are explicit.
- [ ] Business rules and lifecycle transitions are explicit.
- [ ] Implementation is complete for the increment.
- [ ] Focused verification exists.
- [ ] Runtime evidence supports runtime claims.

### Documentation

- [ ] Business operation manual exists or is updated.
- [ ] User guide exists or is updated.
- [ ] Status and next-action guidance exists.
- [ ] FAQ and troubleshooting exist or are updated.
- [ ] Documentation matches verified runtime.

### Product Guidance

- [ ] In-app help exists.
- [ ] Context mapping is verified.
- [ ] Workflow Assistant is implemented or justified as not applicable.
- [ ] Runtime checklist is implemented or justified as not applicable.
- [ ] Accessibility and responsive scope is recorded.

### Delivery

- [ ] Documentation and code are reviewed together.
- [ ] Known limitations are separated into follow-up increments.
- [ ] Evidence identifies the authoritative commit.
- [ ] No unsupported PASS claim exists.
