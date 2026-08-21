# Position Authority Wave 2N — Sale Return

## Scope

Wave 2N migrates Sale Return authorization to Position-first capability authority without changing the existing return transaction semantics.

## Capabilities

- `sales.return`
  - required for Sale Return eligibility, history, detail, and completion routes.
- `sales.return.deduction-approve`
  - required only when the calculated refund contains a deducted amount greater than zero.

## Compatibility

Historical Sale Return routes were authenticated-only, so legacy Position-null employees retain route access for OWNER, MANAGER, CASHIER, and TECHNICIAN.

Historical deducted-refund approval was OWNER/MANAGER/ADMIN/SUPERADMIN-only. Compatibility therefore grants `sales.return.deduction-approve` only to OWNER and MANAGER among employee roles; ADMIN/SUPERADMIN remain platform-authorized.

A non-null Position capability array is authoritative, including an empty array.

## Existing business authority preserved

This wave does not change:

- branch-scoped sale eligibility,
- serialized and SIMPLE returnability checks,
- refund projection and payment evidence validation,
- idempotency/replay behavior,
- transaction locking and conflict handling,
- serialized stock restoration,
- SIMPLE stock restoration and inventory movement evidence,
- refund evidence creation,
- return receipt presentation snapshot,
- completion command persistence.

The previous deducted-refund role-name policy is replaced with the centralized Position capability decision.

## Deliberate exclusions

This wave does not migrate general Sale Payment, `mark-paid`, tax-document lifecycle, or document-replacement authority. Those remain separate authority domains.

## Verification

Focused local verification should include:

```bash
node src/modules/sales/return/shared/saleReturnAuthorization.test.js
node scripts/verify-employee-lifecycle-runtime.js
npm run test
npx prisma validate
```
