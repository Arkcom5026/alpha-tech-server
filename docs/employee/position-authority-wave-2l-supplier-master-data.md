# Position Authority Wave 2L — Supplier Master Data

## Scope

Wave 2L migrates Supplier master-data authorization from authenticated-only access to Position-first capability authority without changing Supplier business rules.

## Archaeology

`src/modules/supplier/routes/supplierRoutes.js` historically used only `verifyToken` for all Supplier routes:

- `POST /` create Supplier
- `GET /` list Suppliers
- `GET /:id` Supplier detail
- `PUT /:id` update Supplier
- `DELETE /:id` delete Supplier

Because all authenticated employee roles historically reached these routes, legacy compatibility preserves access for OWNER, MANAGER, CASHIER and TECHNICIAN while Position migration is incomplete.

Deletion already has separate domain safeguards:

- branch ownership
- system Supplier cannot be deleted
- Supplier referenced by Purchase Orders cannot be deleted

Wave 2L keeps those rules unchanged.

## Capabilities

- `procurement.supplier`
  - list/read Supplier
  - create Supplier
  - update Supplier
- `procurement.supplier.delete`
  - destructive Supplier deletion
  - route requires both `procurement.supplier` and `procurement.supplier.delete`

Delete capability alone does not imply Supplier access.

## Compatibility

- `Position.capabilities = null` → legacy `v2Role` compatibility
- OWNER / MANAGER / CASHIER / TECHNICIAN retain historical Supplier behavior
- non-null capability array → Position is authoritative, including an empty array
- ADMIN / SUPERADMIN remain system-authorized

## Out of Scope

- no Prisma schema or migration
- no Supplier business-rule changes
- no Purchase Order, Receipt or Supplier Payment behavior changes
- no deletion of `v2Role`

## Verification

Focused server contract:

```bash
node src/modules/supplier/shared/supplierAuthorization.test.js
```

Then run the standard employee lifecycle verifier, full server certification and Prisma validation. Client should run the Position capability UI contract, onboarding compatibility contract, typecheck and production build.
