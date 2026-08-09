# Step 8 — Input VAT Authority Runtime Notes

- `InputVatRecord` is the approved input-tax-document ledger authority. It captures the gross tax-document amounts after reconciliation and approval.
- `InputTaxFilingItem` remains the claim/eligibility authority, including partial eligibility, deferred claims, selection, and filed status.
- Input Tax Report reads `InputVatRecord` first. Historical `PurchaseOrderReceipt` rows remain an explicit compatibility fallback only when the supplier tax invoice identity is not represented by an authority record.
- No historical backfill is performed by this step.
- Runtime must not be merged/deployed before `20260809213500_input_vat_authority_foundation` exists in Production.
