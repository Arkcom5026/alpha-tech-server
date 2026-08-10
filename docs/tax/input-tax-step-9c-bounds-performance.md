# Input Tax 10/10 — Step 9C Bounds and Performance Policy

## Scope

Step 9C establishes bounded production behavior for Input Tax report and overview reads without changing tax/accounting semantics.

## Input VAT Report

- Primary authority remains `InputVatRecord`.
- Legacy `PurchaseOrderReceipt` remains compatibility fallback only.
- Maximum request range: 366 days.
- Maximum projected rows: 2,000.
- Repository reads use `MAX_REPORT_ROWS + 1` so overflow is detected without loading an unbounded result set.
- Oversized requests are refused with machine-readable codes:
  - `INPUT_TAX_REPORT_RANGE_TOO_LARGE`
  - `INPUT_TAX_REPORT_RESULT_TOO_LARGE`
- Deterministic ordering uses date, document number, then row id.
- Summary is calculated only when the complete bounded result fits; the API does not silently return a partial accounting summary.

## Input Tax Overview

- Maximum explicit `periodFrom`/`periodTo` request range: 366 days.
- Oversized requests are refused with `INPUT_TAX_OVERVIEW_RANGE_TOO_LARGE`.
- Existing aggregate semantics are preserved: the service receives the complete bounded period rather than paginating the underlying aggregate and producing incorrect totals.
- Repository ordering already uses period date and TaxDocument id as deterministic tie-breaker.
- The overview projection uses lateral aggregate queries rather than per-row application-level follow-up queries, avoiding an application N+1 loop for receipt-link and filing summary projection.

## Performance Baseline Contract

Repository-level target boundaries for Step 9C:

- Input VAT Report: at most two bounded root reads (authority + legacy compatibility) per request, each capped at 2,001 rows.
- Input Tax Overview: one bounded current-period projection plus the existing previous-period comparison projection; each request period must remain within 366 days.
- No endpoint introduced by Step 9C may load an unlimited multi-year TaxDocument/InputVatRecord history into application memory.
- No new Prisma migration or index is introduced because current evidence does not prove an index deficiency requiring schema change.

Runtime latency and database execution-plan targets remain Runtime Gate evidence. They must be measured on Local/runtime with representative data before Production certification; repository code inspection alone is not claimed as a latency PASS.

## Export Policy

Step 9C does not add a new export implementation. Any current or future Input Tax export must consume a bounded authority projection or explicitly refuse oversized requests. Silent full-history in-memory export is prohibited. Chunked/batched export may be introduced only when an actual export surface requires it.

## Deferred Surfaces

Investigation, audit-package, simulation, supplier-health and executive surfaces must apply the same bounded-query rule when their concrete HTTP/list/export contracts are present in the continuation baseline. Step 9C does not fabricate missing endpoints solely to satisfy a checklist.

## Safety

- No Stock/Inventory/Payment mutation.
- No Input VAT authority duplication.
- No Prisma/schema change.
- No change to VAT/accounting calculations.
