# Input Tax Overview V1 — Development Agenda

## Status

Approved for implementation on 2026-07-29.

## Mission

Establish the first read-only management and audit projection for Alpha-Tech input tax using TaxDocument-centric authority.

The increment creates the foundation for monthly management overview, reconciliation quality, filing readiness, drill-down, and later period closing without changing current receipt or filing persistence workflows.

## Architecture Goal

1. Introduce `INPUT_TAX_OVERVIEW_V1` as the stable read-only projection contract.
2. Use TaxDocument and its receipt-link/reconciliation relationships as reporting authority rather than reading directly from PurchaseOrderReceipt.
3. Separate document-period amounts from claim and filing-period amounts.
4. Introduce input-tax-specific reconciliation, quality, eligibility, and filing-readiness semantics.
5. Standardize monetary API values as Decimal strings and avoid JavaScript floating-point authority.
6. Preserve drill-down consistency between overview metrics and document-list filters.

## Planned Scope

- Contract and semantic definitions
- Period-view model
- Decimal money contract
- Overview query/application boundary
- TaxDocument-centric repository projection
- Monthly comparison
- Reconciliation metrics
- Quality and attention metrics
- Filing-readiness foundation
- Breakdown projections
- Recent documents
- Drill-down-compatible filters
- Contract verification

## Hybrid State Identified

The legacy input-tax report reads directly from PurchaseOrderReceipt, does not fully cover QUICK_RECEIPT, and InputTaxFilingItem remains receipt-centric.

These states are documented, but durable filing migration is explicitly deferred to a separate increment.

## Architecture Elevation

Input tax moves from receipt-centric operational reporting toward a TaxDocument-centric control center covering document authority, reconciliation quality, claim eligibility, filing readiness, and future period closing.

## Backward Compatibility

- Preserve existing PO receipt and quick receipt runtime behavior.
- Preserve existing tax-document operations and reconciliation workflows.
- Do not remove or replace the legacy report until the new projection is verified.
- Do not change filing persistence in this increment.

## Runtime Impact

Read-only projection work only. No Prisma migration, receipt workflow, tax filing state mutation, or existing business behavior may be changed in this increment.

## Verification Gates

- Contract tests
- Targeted input-tax overview tests
- Existing tax tests
- Prisma validate and generate only if Prisma projection is touched
- `git diff --check`
- Runtime and operational evidence recorded separately

## Increment Policy

One increment equals one Draft PR. The Draft PR is the working area and evidence record for Input Tax Overview V1.
