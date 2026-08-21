# Delivery Note Lifecycle — Wave 1C History Projection

Status: CHECKPOINT — pure history projection ready for focused verification

## Objective

Create one shared history projection that converts the current Sale-backed Delivery Note evidence into document-lifecycle metadata without changing persistence or write authority.

This wave intentionally separates lifecycle history semantics from the existing unified history controller wiring. The projection must be proven first; controller adoption follows only after focused verification.

## Projection contract

For a Sale-backed Delivery Note, the history projection exposes:

- lifecycleState
- lifecycleActions
- lifecycleHistoricalReadable
- lifecycleCurrentAuthority
- grossAmount / grossTotalAmount
- returnedAmount
- activeAmount / billableAmount
- paidAmount
- balanceAmount
- activeConsolidation
- issuedTaxDocument

Historical gross identity remains unchanged.

## Production reference

SL-022608-0077:

- historical gross: 1,810.00
- returned: 640.00
- active/billable: 1,170.00
- paid: 0.00
- balance: 1,170.00
- lifecycle: ADJUSTED

A consolidated source remains historically readable but is no longer current/actionable authority.

An ADJUSTED source with an issued tax invoice requires statutory correction and cannot create another adjusted Delivery Note, consolidate again, or hand off tax authority again.

## Compatibility boundaries

- no schema migration
- no Delivery Note aggregate persistence yet
- no endpoint/controller behavior change in this checkpoint
- no stock/payment/receivable/tax mutation
- Sale.totalAmount remains immutable historical gross
- SaleDocumentReplacement financial-lock semantics remain separate from return-adjusted lifecycle revision semantics

## Focused verification

Run:

```powershell
node tests/delivery-note-lifecycle-domain-foundation.contract.test.js
node tests/delivery-note-lifecycle-compatibility-loader.contract.test.js
node tests/delivery-note-lifecycle-wave1b-print-read-integration.contract.test.js
node tests/delivery-note-lifecycle-wave1c-history-projection.contract.test.js
node tests/delivery-note-history-print-eligibility.contract.test.js
```

If all PASS, the next integration step is to wire this projection into unifiedDocumentHistoryController while preserving historical visibility separately from action eligibility.
