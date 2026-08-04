# Product Template Discovery Candidate Materialization — Slice 4

## Goal
Materialize only `UNMATCHED` Store Products from the read-only Discovery Audit into real `ProductTemplateCandidate` records so the existing Candidate Review Queue can display and govern them.

## Authority
- Product in the resolved SYSTEM TEMPLATE Branch is the platform Template authority.
- The Template Branch `categoryId` scopes Store Branch discovery.
- `Active visible` and legacy Product Template UI counters are not discovery authority.
- Candidate is a review record, not the source of Product truth.

## Endpoint
`POST /api/product-templates/candidates/discovery-materialize`

Payload:
```json
{
  "businessType": "IT",
  "apply": false,
  "limit": 100
}
```

`apply=false` is dry-run. `apply=true` creates candidates.

## Idempotency
Only Discovery items classified `UNMATCHED` are eligible. Products with an open Candidate are classified `CANDIDATE_OPEN` and excluded from subsequent materialization.

## Safety
- Superadmin only.
- Explicit apply gate.
- Maximum 500 candidates per run.
- No Product, Template, stock, serial, cost, price, supplier, or transaction mutation.
- Uses the existing Candidate creation ownership and audit-event authority.
