# Backend Slice Plan v3.1

## Slice 1 — Repair Intake and Diagnosis

- Create Repair Job
- Register device, accessories, intake evidence, and custody
- Record diagnosis and warranty eligibility

## Slice 2 — Warranty Claim Child Runtime

- Open only from Repair Job route/context
- Claim lifecycle policy
- Append-only claim events
- Claim custody and stock movement transaction
- Idempotent completion

## Slice 3 — Repair Resume and Completion

- Resume from resolved claim into quality check
- Delivery confirmation
- Close outcome and follow-up recommendation
- Idempotent Repair completion

## Slice 4 — Independent Sale Return Follow-up

- Start a new Sale Return only after Repair Job closes
- Store optional source Repair Job evidence reference
- Re-run canonical Sale Return eligibility and approval
- No cross-flow state mutation

## Slice 5 — Trace Projection

- Extend Product Trace read model with Repair and Claim events
- Show a later Sale Return as a separate linked workflow
