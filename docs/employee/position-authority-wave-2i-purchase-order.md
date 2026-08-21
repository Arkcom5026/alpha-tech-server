# Position Authority Wave 2I — Purchase Order

## Goal
Move Purchase Order business authority from broad authenticated employee access to Position capabilities while preserving legacy behavior during migration.

## Capabilities
- `procurement.purchase-order`
  - list/read Purchase Orders
  - create Purchase Orders
  - create the compatibility `with-advance` route (the current runtime rejects advance consumption and creates a normal PO)
  - edit Purchase Orders
  - view PO presentation
- `procurement.purchase-order.control`
  - delete a Purchase Order
  - change Purchase Order status
  - route guards require both `procurement.purchase-order` and `procurement.purchase-order.control`

## Receipt-boundary correction
Two routes are mounted under the Purchase Order router but are semantically part of Purchase Receipt:
- `GET /eligible-for-receipt`
- `GET /:id/detail-for-receipt`

Wave 2I protects these with existing `procurement.receipt`, not Purchase Order authority. This keeps PO preparation and receipt execution independently assignable.

## Compatibility
Before Position migration, the Purchase Order router was guarded only by `verifyToken`. Therefore legacy/null-position OWNER, MANAGER, CASHIER, and TECHNICIAN keep both Purchase Order capabilities so the migration does not silently remove existing access.

Once `Position.capabilities` is any non-null array, Position authority is authoritative. An empty array grants no Purchase Order authority. ADMIN/SUPERADMIN continue to receive registered capabilities through system-role authority.

## Security boundaries retained
Position capability checks do not replace:
- branch ownership checks
- authenticated employee identity
- existing service validation
- supplier/payment authority
- Purchase Receipt authority
- price/cost policy

The status endpoint currently accepts a normalized status string after branch ownership validation. Wave 2I therefore treats status mutation as an elevated control action; lifecycle/transition hardening can be addressed independently if evidence requires it.

## No schema migration
This wave uses the existing `Position.capabilities` JSON authority surface. No Prisma schema or database migration is required.

## Local verification
```powershell
node src/modules/procurement/purchase-order/shared/purchaseOrderAuthorization.test.js
node src/modules/procurement/purchase-order/purchaseOrderModuleImports.test.js
node src/modules/procurement/purchase-order/create/createPurchaseOrderSlice.test.js
node src/modules/procurement/purchase-order/status/updatePurchaseOrderStatusSlice.test.js
node scripts/verify-employee-lifecycle-runtime.js
npm run test
npx prisma validate
```
