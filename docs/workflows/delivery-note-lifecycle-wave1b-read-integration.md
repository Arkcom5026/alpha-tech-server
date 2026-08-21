# Delivery Note Lifecycle — Wave 1B Read Integration

Status: IN PROGRESS — additive read integration checkpoint

## Purpose

Connect the Wave 1 lifecycle resolver to the existing canonical Sale-backed Delivery Note print read model without changing persistence or historical print semantics.

This is intentionally an additive compatibility step between the pure domain foundation and first-class Delivery Note persistence.

## Scope

Wave 1B currently integrates lifecycle metadata into:

- `src/modules/sales/documents/print/projectSaleDeliveryNoteService.js`

The existing print response now exposes:

- `lifecycleState`
- `grossAmount`
- `returnedAmount`
- `activeAmount`
- `lifecycleActions`
- full `deliveryNoteLifecycle` compatibility projection

The source query now loads `returnedQuantity` for STOCK and SIMPLE Sale lines so the lifecycle projection can derive active remaining quantity/value from existing return evidence.

## Compatibility rule

Wave 1B MUST NOT silently rewrite the historical document body.

Therefore:

- existing `document.totalAmount` remains `Sale.totalAmount`
- existing source/replacement line rendering remains unchanged
- a source consolidated into an active consolidated delivery remains blocked from the legacy active-print route
- financial-lock `SaleDocumentReplacement` remains a separate authority

This means an ADJUSTED source Delivery Note may expose:

- historical gross `1,810.00`
- returned value `640.00`
- active amount `1,170.00`

while the historical print body still represents the original issued document until a first-class adjusted Delivery Note revision is persisted in a later wave.

## Production reference

`SL-022608-0077`

- original Delivery Note gross: `1,810.00`
- returned APACER value: `640.00`
- active remaining value: `1,170.00`
- expected lifecycle: `ADJUSTED`

The read model must surface those lifecycle facts without mutating the original Sale or original Delivery Note evidence.

## Safety invariants

1. Read integration writes no stock movement.
2. Read integration creates no Sale or Payment.
3. Read integration creates no receivable or tax authority.
4. Existing document number remains stable.
5. Existing historical print total remains stable.
6. Consolidated-source legacy print guard remains active.
7. Return-aware values are additive metadata until revision persistence exists.

## Deliberate deferrals

Not included in this checkpoint:

- lifecycle persistence/schema
- adjusted Delivery Note creation
- unified history visibility for SUPERSEDED/CONSOLIDATED source documents
- manual Document Workspace consumption rewrite
- tax handoff rewrite
- client lifecycle badges/actions

Those integrations must consume the same lifecycle authority rather than independently recalculating return state.

## Verification

Focused contracts:

```text
node tests/delivery-note-lifecycle-domain-foundation.contract.test.js
node tests/delivery-note-lifecycle-compatibility-loader.contract.test.js
node tests/delivery-note-lifecycle-wave1b-print-read-integration.contract.test.js
node tests/delivery-note-history-print-eligibility.contract.test.js
node tests/sale-delivery-note-on-demand-issuance.contract.test.js
```

No schema migration is required for Wave 1B.
