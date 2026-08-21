# Position Authority Wave 2J — Supplier Payment Read Boundary

## Goal

Move Supplier Payment history/read access onto Position-first authority without reopening financial write behavior that is intentionally closed.

## Capability

- `procurement.supplier-payment.read`

This capability permits access to Supplier Payment and Supplier Advance history/query endpoints only.

## Routes covered

- `GET /api/supplier-payments/advance`
- `GET /api/supplier-payments/by-supplier/:supplierId`
- `GET /api/supplier-payments/`
- `GET /api/supplier-payments/by-po/:poId`

## Financial mutation boundary deliberately preserved

Wave 2J does **not** introduce or reopen Supplier Payment mutations.

Existing mutation behavior remains authoritative:

- `POST /api/supplier-payments/` still requires authenticated branch/employee actor context and returns `409 SUPPLIER_PAYMENT_AUTHORITY_REQUIRED`.
- `DELETE /api/supplier-payments/:id` still returns `409 SUPPLIER_PAYMENT_REVERSAL_REQUIRED` because financial history must be reversed rather than hard-deleted.

A future payment/reversal authority wave must first identify the canonical finance command, idempotency, approval and audit boundaries. Read capability must not be treated as payment authority.

## Compatibility

Supplier Payment read routes were historically protected only by authentication. During migration:

- `Position.capabilities = null`: legacy OWNER / MANAGER / CASHIER / TECHNICIAN keep existing read behavior through compatibility projection.
- `Position.capabilities = []` or another non-null array: Position is authoritative and `procurement.supplier-payment.read` must be explicit.
- ADMIN / SUPERADMIN retain all registered capabilities.

## Verification

Focused contract:

```bash
node src/modules/procurement/supplier-payment/shared/supplierPaymentAuthorization.test.js
```

Then run the repository certification and Prisma validation gates before publishing.
