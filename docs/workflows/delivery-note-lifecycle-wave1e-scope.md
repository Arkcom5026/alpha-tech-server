# Delivery Note Lifecycle — Wave 1E Scope

Wave 1E is intentionally read-only.

Goals:
- make Document Workspace list projections return-aware
- derive original / returned / active quantity and amount per source line
- mark fully returned lines as RETURNED and not eligible for consolidation
- preserve existing payment/documented state semantics for active value
- expose sale-level return-adjustment metadata for UI consumption

Non-goals:
- do not change Document Workspace confirmation/write semantics in this wave
- do not create a Delivery Note revision record
- do not mutate stock, Sale, payment, receivable, tax, or settlement state
- do not change existing consolidated-document persistence

The write guard that rejects stale/returned requested lines belongs to the next write-authority wave after this read model passes local verification.