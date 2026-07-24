# Runtime Invariants v3.1

## Warranty Claim opening

A claim may be opened only when:

- Repair Job exists in the actor's branch.
- Repair Job is not CLOSED or CANCELLED.
- Repair Diagnosis exists and recommends warranty handling.
- Claim asset belongs to the Repair Job context.
- No conflicting active claim exists for the same asset.

## Repair completion

Repair Job may close only when:

- No linked Warranty Claim remains active.
- Final result and `closeOutcome` are recorded.
- Required quality check has completed, unless policy explicitly allows an unrepaired return.
- Delivery confirmation exists.
- Custody has returned to the customer.

## Sale Return follow-up

A Sale Return referencing `sourceRepairJobId` may start only when:

- Source Repair Job status is CLOSED.
- Source Repair Job outcome/recommendation permits return review.
- Original Sale/SaleItem remains independently eligible.
- No conflicting Sale Return exists.

Repair evidence supports the decision but does not bypass Sale Return policy.

## Financial authority

- Warranty supplier credit/refund belongs to Warranty Claim/Supplier finance context.
- Customer refund/exchange belongs to Sale Return.
- Repair operational amounts are projections, not ledger evidence.
