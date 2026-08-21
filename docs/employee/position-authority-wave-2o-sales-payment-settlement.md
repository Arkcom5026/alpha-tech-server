# Position Authority Wave 2O — Sales Payment & Settlement

## Scope

Wave 2O migrates the remaining payment-evidence and sale-settlement closure surfaces to Position-first authority without changing payment, customer-money, tax, inventory, or document business semantics.

## Capabilities

- `sales.payment.read`
  - read/print payment evidence through the dedicated Sales Payment router.
- `sales.payment.manage`
  - create payment evidence.
- `sales.payment.cancel`
  - cancel/reverse payment evidence; route requires both `sales.payment.manage` and `sales.payment.cancel`.
- `sales.settlement.close`
  - execute the legacy `mark-paid` sale-closure mutation after the existing payment projection checks.

Cancellation authority alone does not imply payment creation authority. Settlement close is deliberately independent from payment creation/cancellation and does not imply `sales.core`.

## Compatibility

The migrated Payment routes and `mark-paid` boundary were historically authenticated-only. While a Position still has `capabilities = null`, OWNER, MANAGER, CASHIER, and TECHNICIAN therefore retain these four capabilities for compatibility.

A non-null Position capability array is authoritative, including an empty array. ADMIN and SUPERADMIN remain authorized through platform role authority.

## Existing business authority preserved

This wave does not alter:

- payment validation or branch/customer ownership,
- sale payment projection and outstanding-balance rules,
- deposit/customer-money locking or restoration behavior,
- payment evidence persistence,
- payment cancellation/reversal semantics,
- `mark-paid` controller/service financial checks,
- inventory authority,
- tax candidate/document lifecycle,
- Sale Return behavior,
- Delivery Note or document-presentation flows.

## Deliberate exclusions

Delivery Note lifecycle work is outside this wave. General Customer Money settlement routes, tax-document lifecycle, quotation flows, and document preparation/replacement remain separate authority domains.

## Verification

```bash
node src/modules/sales/payment/shared/paymentAuthorization.test.js
node src/modules/sales/settlement/shared/saleSettlementAuthorization.test.js
node scripts/verify-employee-lifecycle-runtime.js
npm run test
npx prisma validate
```

Client verification should include the Position authority contract, onboarding compatibility contract, typecheck, and production build.
