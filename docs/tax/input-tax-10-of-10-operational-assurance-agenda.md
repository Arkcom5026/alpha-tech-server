# Input Tax 10/10 Operational Assurance Agenda

## Mission

Elevate Alpha-Tech Input Tax from a strong TaxDocument-centric foundation to a complete operational assurance system with explainable decisions, auditable workflows, filing authority, investigation ownership, and auditor-ready evidence.

This agenda starts from server `main`, including Input Tax PR #77 merged at `db7130094e9e1a36ecc64f93d55a56a31b19e570`.

## Working Policy

- One agenda = one Draft PR working area.
- Repository is the source of truth.
- Backend owns tax rules and mutation authority.
- Frontend consumes explicit contracts and never recreates duplicate, eligibility, replacement, filing, period, or risk decisions.
- Runtime, Operational, and Production verification remain separate gates.
- No merge without explicit product-owner approval.

## Target Outcome

The completed system must answer, with evidence:

1. What happened to each TaxDocument from intake through filing or replacement?
2. Why is VAT claimable, blocked, deferred, selected, filed, or rejected?
3. Who owns each unresolved tax issue, what was decided, and when?
4. What will happen if the current filing batch is submitted now?
5. Can an auditor receive a complete, reproducible evidence package without manual document hunting?
6. Which suppliers, branches, periods, and workflows create recurring tax risk?

## Complete Scope

### Increment 1 — Authoritative Filing HTTP Contract

Expose the existing filing domain authority through explicit shop-scoped HTTP contracts:

- list filing batches and items
- create/ensure a monthly filing batch
- select eligible TaxDocument for filing
- remove selected TaxDocument with reason
- mark filing batch filed
- reject mutation when period is CLOSED, LOCKED, or SUBMITTED
- optimistic/idempotent mutation behavior
- server-side recalculation and response projection
- audit event for every filing mutation

### Increment 2 — Duplicate Decision and Replacement Authority

Add durable review authority rather than projection-only detection:

- duplicate review case
- confirm duplicate
- resolve not duplicate
- review reason, evidence snapshot, actor, timestamps, and version
- replacement-chain mutation contract
- predecessor/successor integrity
- conflict detection and refusal
- prevent superseded TaxDocument from independent claimability
- immutable decision/audit history

### Increment 3 — Tax Timeline and Explainability

Create a unified TaxDocument timeline projection covering:

- candidate registration
- document creation and lifecycle transitions
- source and receipt links
- reconciliation changes
- eligibility decisions
- duplicate decisions
- replacement-chain events
- filing selection/removal/submission
- period close/reopen/lock/submit
- investigation events

Every blocked or disabled action must return machine-readable reason codes and an actionable Thai explanation contract.

### Increment 4 — Tax Investigation Workspace Foundation

Introduce durable operational cases for tax exceptions:

- duplicate investigation
- replacement conflict investigation
- reconciliation mismatch investigation
- missing supplier tax ID/document number/source investigation
- assign owner
- priority and due date
- comments/notes
- status: OPEN, IN_REVIEW, WAITING_EXTERNAL, RESOLVED, DISMISSED
- resolution classification and evidence
- escalation and stale-case indicators
- shop/branch isolation

### Increment 5 — Filing Simulation and Pre-Submission Control

Provide a server-authoritative simulation before submission:

- ready, selected, blocked, deferred, and filed totals
- claimable VAT and excluded VAT
- blocker counts and amounts by reason
- duplicate/replacement conflicts
- unlinked and allocation mismatch impact
- period authority state
- deterministic simulation version/snapshot
- comparison between simulation and actual filed batch
- explicit refusal when data changes after simulation

### Increment 6 — Audit Package Generator

Generate an immutable audit package manifest containing:

- filing batch and period summary
- TaxDocument register
- source traceability
- receipt allocation and reconciliation evidence
- eligibility/duplicate/replacement decisions
- timeline and investigation resolutions
- actor/timestamp/version metadata
- package checksum and generation metadata
- export-ready CSV/JSON contracts
- PDF/XLSX generation adapters may follow as delivery surfaces, but manifest authority must be format-neutral

### Increment 7 — Supplier Tax Health and Risk Scoring

Add explainable analytics without opaque AI authority:

- supplier missing-data rate
- duplicate-risk rate
- replacement/conflict rate
- reconciliation failure rate
- filing acceptance/deferral rate
- unresolved investigation count and age
- branch and period comparisons
- deterministic Tax Health Score with versioned factors
- every score must expose contributing signals and weights

### Increment 8 — Executive Explainable Overview

Extend overview contracts to answer why values changed:

- VAT and claimable VAT movement drivers
- top supplier contributors
- blocked/deferred movement
- duplicate/replacement movement
- unresolved quality movement
- period-over-period reason summaries
- direct drill-down identifiers for affected documents/cases

### Increment 9 — Security, Controls, and Non-Functional Assurance

- role/capability matrix for view, review, decide, file, reopen, and export
- separation of duties for high-impact actions
- mandatory reasons for destructive/reversal actions
- concurrency and replay protection
- pagination and bounded export behavior
- performance targets for overview, lists, timeline, and package generation
- retention and immutability policy
- PII-aware logging
- failure recovery and retry semantics

### Increment 10 — Frontend Contract Handoff and Operational Certification

Produce explicit frontend handoff contracts for the client follow-up PR:

- endpoints and schemas
- affected Input Tax surfaces
- failure-code-to-Thai-message mapping
- disabled-action reasons
- timeline/investigation/filing/audit-package UI states
- backward compatibility impact

Certification gates:

- Repository Gate: architecture, contracts, migrations, tests, docs, diff integrity
- Runtime Gate: install/build/lint/test/Prisma validation and generation
- Operational Gate: Browser → API → service → repository → Prisma → DB → projection → UI
- Production Gate: owner checklist, monitoring, rollback, evidence package verification

## Definition of 10/10

The agenda is complete only when:

- all high-impact mutations are exposed through explicit backend authority
- every tax decision is explainable and auditable
- every unresolved exception can be owned and resolved through a durable workflow
- filing can be simulated and protected against stale data
- auditor evidence can be generated reproducibly
- risk scores expose their inputs and cannot silently become business authority
- shop/branch isolation is proven on reads, writes, exports, and investigations
- focused contract/integration tests pass
- Prisma validation/generation, build, lint, tests, and `git diff --check` pass in runtime authority
- operational and production verification evidence is recorded

## Out of Scope

- output-tax implementation
- legal or accounting advice encoded as autonomous AI decisions
- automatic submission to government systems without a separate approved integration agenda
- unrelated purchase, sales, or finance refactoring
- merging or deploying from this Draft PR without explicit approval
