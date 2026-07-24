# AlphaTech Product Service Platform Foundation v3.1

This package is a boundary-correction patch over v3.

## Authoritative workflow rule

```text
Repair Intake
→ Diagnosis
→ Internal Repair and/or Warranty Claim
→ Receive Back
→ Quality Check
→ Deliver to Customer
→ Close Repair Job
→ optionally start a NEW Sale Return workflow
```

Warranty Claim is a required child process of Repair Job.
Sale Return is an independent workflow and may only reference a CLOSED Repair Job as source evidence.

## Prohibited behavior

- Repair Job must not mutate Sale Return status.
- Warranty Claim must not create customer refunds.
- Sale Return must not close or alter Repair Job.
- No workflow may transform itself into another workflow mid-lifecycle.
- ServiceCase must not act as a giant cross-domain status machine.

## Delivery status

- Schema package: prepared
- Static structural checks: passed
- Prisma CLI validation: must be run locally
- Migration generation/deployment: not authorized yet
