# Workflow Boundary — Repair, Claim, and Sale Return

## Repair is the entry authority

Every claim begins from an existing Repair Job. A Repair Diagnosis supplies the decision evidence for opening a Warranty Claim.

```text
RepairJob 1 ── 0..n WarrantyClaim
```

A new Warranty Claim requires `repairJobId`. `serviceCaseId` is not duplicated on Warranty Claim; it is derived through Repair Job when a ServiceCase exists.

## Claim is internal to the repair journey

Claim resolution returns control to Repair Job:

```text
Claim RESOLVED
→ Repair QUALITY_CHECK
→ Repair READY_FOR_PICKUP
→ Repair DELIVERED
→ Repair CLOSED
```

Claim resolution does not automatically complete the Repair Job.

## Sale Return is a separate follow-up workflow

When the final repair outcome recommends refund or retail exchange:

```text
RepairJob CLOSED
→ create a new SaleReturn
→ run Sale Return eligibility and approval
→ refund/exchange under Sale Return authority
```

`SaleReturn.sourceRepairJobId` is evidence/reference only. It does not grant cross-flow mutation authority.
