# Position Authority Wave 3D — Stock Item Mark-Sold

## Scope

Wave 3D closes the deferred Position-authority boundary for the sales-owned Stock Item SOLD transition.

Covered HTTP mutation:

- `PATCH /api/stock-items/mark-sold`

This endpoint was intentionally excluded from Wave 2E because it is not manual inventory maintenance. It belongs to the sale completion / inventory commitment path.

## Authority decision

No new Position capability is introduced.

The endpoint reuses the existing sales completion authority:

- `sales.core`
- `sales.complete`

Both capabilities are required, matching the canonical `POST /api/sales/complete` boundary.

This avoids creating a duplicate `inventory.mark-sold` capability for an operation whose business ownership is sales completion.

## Compatibility semantics

Existing Position migration semantics remain authoritative:

- `positionCapabilities == null` => legacy `v2Role` / employee-role compatibility fallback.
- any non-null capability array, including `[]`, => migrated Position is authoritative.
- platform `ADMIN` and `SUPERADMIN` retain centralized all-capability authority.
- Position names never grant access.

The legacy sales matrix already grants `sales.core` and `sales.complete` to OWNER, MANAGER, CASHIER, and TECHNICIAN, so this Wave does not silently remove historical access before a Position is migrated.

Once migrated, both capabilities must be assigned explicitly. Having only `sales.core` or only `sales.complete` is insufficient.

## Route boundary

`src/modules/inventory/stock-item/routes/stockItemRoutes.js` keeps the Stock Item HTTP endpoint but explicitly delegates its authority to the sales authorization module:

- `allowSalesCapabilities(SALES_CAPABILITY.CORE, SALES_CAPABILITY.COMPLETE)`

The manual Stock Item lifecycle guard remains unchanged:

- `inventory.lifecycle` => manual status changes and deletion

The receive guard remains unchanged:

- `inventory.receive` => stock receiving operations

Therefore SOLD transition authority stays separated from manual inventory maintenance.

## Domain semantics preserved

Wave 3D does not change `markStockItemsAsSold` business behavior:

- authenticated branch is still required
- stockItemIds must be a non-empty valid array
- all target Stock Items must belong to the actor branch
- all target Stock Items must still be `IN_STOCK`
- update remains branch-scoped and race-aware
- partial/concurrent failures remain fail-closed with existing conflict codes

No Prisma schema or migration is required.

## Client impact

No client capability-group change is required because `sales.core` and `sales.complete` already exist in Position configuration.

Existing client `markStockItemsAsSold` API/service ownership remains unchanged.

## Verification targets

Focused server verification:

- `node src/modules/inventory/stock-item/shared/stockItemMarkSoldAuthorization.test.js`
- `node src/modules/inventory/stock-item/shared/stockItemAuthorization.test.js`
- `node src/modules/inventory/stock-item/stockItemSlices.test.js`
- `node src/modules/sales/shared/salesAuthorization.test.js`
- `node scripts/verify-employee-lifecycle-runtime.js`
- `npm run test`
- `npx prisma validate`
