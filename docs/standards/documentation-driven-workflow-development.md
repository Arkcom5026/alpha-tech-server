# Documentation-Driven Workflow Development Standard (DDWD)

## Status

Approved organizational standard for Alpha-Tech workflow development.

## Purpose

Every business workflow delivered by Alpha-Tech must be understandable and operable by its intended users without depending on the development team for routine guidance.

A workflow is not complete merely because its database, API, UI, and tests exist. It is complete only when users can learn the workflow, execute it correctly, understand its states, recover from common problems, and access guidance from the product itself.

## Core Principle

> A workflow is not DONE until users can learn and operate it correctly through the system itself.

Documentation is a product capability, not an after-delivery attachment.

## Applicability

This standard applies to every workflow used in real operations, including but not limited to:

- repair and warranty claim
- sales and reservation
- purchase and receiving
- inventory and stock movement
- input tax and output tax
- customer, supplier, employee, and partner operations
- service fees and service delivery
- any new workflow introduced after this standard

Purely internal refactors that do not change user behavior may document only architecture and verification impact. When user behavior, business rules, state transitions, permissions, or operational decisions change, the workflow documentation must be reviewed and updated.

## Required Delivery Layers

### 1. Business Workflow

Define:

- actors and responsibilities
- entry conditions
- ordered operational steps
- decisions and branches
- terminal outcomes
- exception and recovery paths

### 2. Business Operation Manual

Explain how the business should perform the work, including why evidence, identifiers, approvals, and controls are required.

### 3. User Guide

Explain what users see, what they enter, what each action does, what result to expect, and what should happen next.

### 4. Business Rules and Functional Contract

Record permissions, invariants, validation rules, lifecycle transitions, authority boundaries, and important error behavior.

### 5. In-App Help

Every material workflow must expose contextual guidance from the active workspace without forcing users to leave their current task.

The help entry point should support, as appropriate:

- contextual opening section based on route or workflow state
- search
- ordered steps
- checklist
- status meaning
- FAQ
- troubleshooting
- links back to relevant actions

### 6. Workflow Assistant

When the runtime state can provide reliable guidance, the system should indicate:

- current workflow stage
- completed and incomplete prerequisites
- permitted next actions
- blocked actions and reasons
- relevant guide topic

This layer is required when it materially reduces user error. It is not required when it would duplicate obvious interface behavior or create misleading pseudo-intelligence.

### 7. Runtime Checklist

Where completion depends on operational evidence, approval, handover, reconciliation, or safety-critical verification, the UI should present a runtime checklist tied to actual state rather than a static list alone.

### 8. FAQ and Troubleshooting

Document common questions, recoverable errors, interrupted-session behavior, duplicate prevention, missing data, permission limits, and escalation boundaries.

## Module Ownership

Workflow-specific documentation and in-app help belong to the owning module.

Examples:

```text
repair/
  help/
  guides/
  contracts/

receiving/
  help/
  guides/
  contracts/
```

Do not move domain-specific content into shared/common components merely to reuse presentation. Only neutral primitives may be shared after their neutrality is proven.

## Documentation Authority Model

Each workflow should maintain two coordinated projections:

1. Repository documentation: detailed and reviewable source of truth for business, functional, and technical understanding.
2. In-app documentation: curated operational projection optimized for use during the active task.

The in-app projection must not invent behavior absent from the runtime. Repository documentation must not claim behavior unsupported by code or runtime evidence.

## Standard Workflow Sequence

```text
1. Business Workflow Design
2. Domain and Business Rule Design
3. Database / API / UI Implementation
4. Verification and Runtime Evidence
5. Business Operation Manual
6. User Guide
7. In-App Help
8. Workflow Assistant, when appropriate
9. Runtime Checklist, when appropriate
10. FAQ / Troubleshooting
11. Documentation Review
12. Merge
```

Documentation may be drafted earlier and should evolve with implementation. Before merge, all published guidance must match the verified runtime.

## Definition of Done

For every workflow increment, mark each item as PASS, NOT APPLICABLE with justification, or PENDING. A workflow cannot be declared DONE while a required item remains PENDING.

### Business and Runtime

- [ ] Business workflow is explicit.
- [ ] Actors and permission boundaries are explicit.
- [ ] Business rules and lifecycle transitions are explicit.
- [ ] Database, API, and UI implementation is complete for the increment.
- [ ] Focused verification exists.
- [ ] Runtime evidence is recorded when runtime behavior is claimed.

### Documentation

- [ ] Business operation manual exists or is updated.
- [ ] User guide exists or is updated.
- [ ] Status meanings and next actions are documented.
- [ ] FAQ and troubleshooting exist or are updated.
- [ ] Documentation reflects the current runtime.

### Product Guidance

- [ ] In-app help exists for material user workflows.
- [ ] Help opens in the relevant operational context.
- [ ] Workflow Assistant is implemented, or NOT APPLICABLE is justified.
- [ ] Runtime checklist is implemented, or NOT APPLICABLE is justified.
- [ ] Accessibility and responsive boundaries are documented and verified within scope.

### Delivery Authority

- [ ] Documentation and code are reviewed together.
- [ ] Known limitations are explicitly separated into follow-up increments.
- [ ] No unsupported PASS claim exists.
- [ ] PR evidence identifies the authoritative commit and verification result.

## PR Requirements

A workflow PR must include a Documentation section containing:

- repository guide paths added or updated
- in-app help paths added or updated
- Workflow Assistant / Runtime Checklist status
- verification performed
- known limitations and follow-up scope

If no documentation change is needed, the PR must explain why the workflow contract and user behavior are unchanged.

## Change Rules

Documentation must be updated in the same increment when any of these change:

- user-visible steps
- required input or evidence
- lifecycle status or transition
- permissions or branch/tenant visibility
- approval or handover behavior
- retry, resume, cancellation, or recovery behavior
- error messages that alter user action
- navigation or entry point

## Evidence Rules

Documentation verification may include:

- contract tests checking required sections and contextual mappings
- build/typecheck evidence
- browser screenshots
- desktop/mobile operational checks
- user-confirmed workflow execution

Evidence must distinguish clearly between:

- repository gate
- build gate
- runtime gate
- operational gate
- production gate

A failure outside the focused increment must be recorded with its owning boundary and follow-up agenda; it must not be silently represented as a PASS.

## Initial Reference Implementation

The Repair In-App Help Center is the first accepted implementation pattern:

- contextual help entry in the Repair workspace
- module-owned help content and UI
- search, steps, checklist, status guidance, FAQ, and troubleshooting
- focused contract and CI gate
- desktop runtime evidence
- mobile global-shell limitation explicitly separated as another agenda

This reference is a pattern, not a requirement to copy its UI literally into every module.

## Governance

This standard is effective immediately for all new workflow increments.

Existing workflows should adopt it progressively, prioritized by:

1. operational frequency
2. business risk
3. training burden
4. error frequency
5. active development schedule

The standard itself must be updated when real implementation evidence shows that a rule is incomplete, overly rigid, or creates unnecessary coupling.
