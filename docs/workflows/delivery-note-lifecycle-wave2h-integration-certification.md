# Delivery Note Lifecycle — Wave 2H Integration Certification

## Purpose
Certify the accumulated Delivery Note lifecycle runtime before integration into `main`.

This wave is verification-only. It does not add a new business capability and does not mutate Sale, Return, stock, payment, receivable, settlement, refund, or tax authorities.

## Certification chain
The runner executes the focused contracts covering:
- Wave 1B print/read integration
- Wave 1C history projection
- Wave 1D unified history integration
- Wave 1E Document Workspace read authority
- Wave 1F Document Workspace write guard
- Wave 2 persistence lineage
- Wave 2B materialization/revision authority
- Wave 2C current revision read/print resolution
- Wave 2D historical lineage read
- Wave 2E historical revision print
- Wave 2F revision HTTP + server-owned numbering
- Wave 2G migration/readiness
- legacy Delivery Note history-print eligibility
- legacy Sale Delivery Note print projection
- syntax checks for the lifecycle, read/print, controller and route surfaces

## Production schema evidence
`--production-schema` additionally runs the Wave 2G production schema verifier. That verifier is read-only and was designed to validate migration provenance, tables, constraints, index definitions and row counts without inserting or updating business data.

## Reconciliation rule
Older archaeology/contract assertions may describe the pre-return-aware behavior. They must not be edited merely to obtain a green build. If a legacy contract fails, reconcile it only when the current implementation and the authoritative lifecycle design prove that the old assertion is obsolete. Runtime behavior must not be weakened to satisfy stale archaeology.

## Required local gate
Run:

```text
node tests/delivery-note-lifecycle-wave2h-integration-certification.contract.test.js
node scripts/verify-delivery-note-lifecycle-wave2h-certification.js --production-schema
npx prisma validate
npx prisma generate
```

The branch remains non-integrable until every step passes. Production runtime deployment remains separate from this certification gate.
