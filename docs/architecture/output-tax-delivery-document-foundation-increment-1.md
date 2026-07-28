# Output Tax & Delivery Document Foundation — Increment 1

## Scope / Mission

Establish the first implementation increment for Output Tax architecture while formally carrying the incomplete Delivery Note domain as a required completion agenda.

This increment must preserve current sales runtime behavior and avoid redesigning procurement, supplier payment, accounts payable, or input tax.

## Architecture Goal

Evolve the current sales-document chain toward explicit domain ownership:

- `Sale` owns the commercial transaction.
- `Delivery` becomes a first-class fulfillment document instead of remaining only a Sale projection.
- `CustomerReceipt` owns money received and allocation.
- `TaxCandidate` owns output-tax intake and decision state.
- `TaxDocument` owns issued tax-document identity, immutable snapshot, lifecycle, and audit.

## Increment 1 Target

1. Align Prisma projection with the existing SQL-migration-owned Tax foundation without recreating prior migrations.
2. Separate Tax Candidate registration concerns from future document conversion policy, while preserving existing compatibility behavior.
3. Introduce an Output-Tax-specific policy boundary so output tax is not governed by input-tax reconciliation rules.
4. Define a complete tax snapshot contract including header and line-level data.
5. Record Delivery Architecture Completion as an implementation obligation, including aggregate identity, delivery lines, partial delivery, immutable snapshot, lifecycle, print authority, and source-event integration with Output Tax.

## Delivery Completion Agenda

Delivery must ultimately support:

- Independent delivery identity and document number
- Delivery lines and delivered quantities
- Partial and multiple deliveries against one Sale
- Recipient, address, serial/device, and delivery evidence snapshots
- Lifecycle and durable history
- Print from Delivery snapshot rather than mutable Sale data
- `DeliveryCompleted` (or equivalent) as a source event evaluated by Output Tax policy
- Correction/replacement relationships without mutating historical documents

The Delivery agenda is in scope for architecture and staged implementation planning. It must not be silently omitted because the current printable delivery is derived from Sale.

## Explicit Non-Goals

- No input-tax redesign
- No procurement redesign
- No supplier-payment/AP redesign
- No recreation of existing `TaxCandidate`/`TaxDocument` SQL migrations
- No broad Sale behavior change outside compatibility requirements
- No premature hard removal of legacy fields or projections

## Existing Authority to Preserve

- Tax source uniqueness and registration idempotency
- Tax document identity uniqueness
- Transactional consistency
- Lifecycle event audit trail
- Branch isolation
- Existing sales completion behavior unless a narrowly necessary compatibility projection requires adjustment

## Current Evidence

Repository discovery, Tax Authority Audit, and Sales Document Boundary Audit are complete. Runtime and operational certification remain pending.

## Delivery Plan

### Increment 1

Output Tax Candidate Decision Foundation

### Increment 2

Sale Output-Tax Snapshot Publisher

### Increment 3

Controlled Tax Document Conversion

### Increment 4

Output Tax Document Issue and Print

### Increment 5

Tax Cancellation and Document Relations

### Increment 6

Delivery Aggregate Foundation

### Increment 7

Delivery Runtime, Partial Delivery, Snapshot, and Print

### Increment 8

Delivery Source Integration with Output Tax Policy
