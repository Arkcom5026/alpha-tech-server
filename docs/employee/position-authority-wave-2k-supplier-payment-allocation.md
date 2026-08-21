# Position Authority Wave 2K — Supplier Payment Allocation

## Scope

Wave 2K migrates the existing Supplier Payment Allocation runtime from hard-coded role-name checks to Position-first capabilities. It does not create a new payment engine and does not reopen the legacy `/supplier-payments` POST/DELETE endpoints that remain fail-closed.

## Existing financial runtime discovered

`src/modules/procurement/payments/http/supplierPaymentAllocationRoutes.js` already exposes an active financial authority:

- `GET /` — list allocation-authority payments
- `POST /` — create a confirmed Supplier payment allocated to open payables
- `POST /:paymentId/void` — reverse a confirmed payment

Before Wave 2K, the router inferred authority from role names:

- OWNER / MANAGER: list + create
- OWNER only: void
- ADMIN / SUPERADMIN: all

The repository already protects money integrity with transaction locking, branch/supplier/payable scoping, outstanding checks, allocation persistence, payable balance/status updates, and auditable VOID reversal.

## Capabilities

- `procurement.supplier-payment.manage`
  - preserves the existing OWNER/MANAGER financial-management boundary
  - required for the allocation-authority list and create-confirmed endpoints
- `procurement.supplier-payment.void`
  - preserves the existing OWNER-only reversal boundary
  - void also passes through the manage guard, so VOID alone is not enough at the route boundary

`procurement.supplier-payment.read` from Wave 2J remains a separate capability for the older read-only Supplier Payment history/query surface.

## Compatibility semantics

- `Position.capabilities = null`
  - OWNER: manage + void
  - MANAGER: manage only
  - CASHIER / TECHNICIAN: neither manage nor void
- non-null Position capability array is authoritative
- ADMIN / SUPERADMIN retain all registered capabilities

## Non-goals

- no Prisma schema or migration
- no change to payment calculations, locking, payable settlement, or reversal algorithms
- no change to actor branch/employee derivation
- no opening of the legacy fail-closed Supplier Payment mutation endpoints
- no approval workflow redesign in this wave

## Verification focus

- legacy OWNER/MANAGER/VOID compatibility
- Position authoritative behavior, including empty arrays
- ADMIN/SUPERADMIN compatibility
- route source no longer infers financial authority from role display values
- existing Supplier Payment allocation service/repository regression coverage through the full certification suite
