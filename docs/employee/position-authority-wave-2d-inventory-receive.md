# Position Authority Wave 2D — Inventory Receive

## Scope

Wave 2D migrates stock intake mutations to Position-first authority without changing procurement, pricing, tax, finance, repair, or stock lifecycle behavior.

Capability introduced:

- `inventory.receive`

This capability controls authenticated HTTP mutations that place received inventory into stock or complete receive-time identity data.

## Runtime boundary

The following stock-item routes require `inventory.receive`:

- `POST /stock-items/`
- `POST /stock-items/receive-sn`
- `POST /stock-items/receive`
- `POST /stock-items/receive-all-no-sn`
- `PATCH /stock-items/update-sn/:barcode`

Unrelated stock-item lifecycle and query routes remain outside this wave.

## Compatibility semantics

Position authority keeps the established null-versus-array rule:

- `positionCapabilities = null`: the employee is still on legacy compatibility authority.
- `positionCapabilities = []` or any non-null array: Position capabilities are authoritative.

Before this wave the receive routes were authenticated but not restricted by a business role. To avoid changing existing employee behavior during migration, legacy OWNER, MANAGER, CASHIER, and TECHNICIAN profiles all receive `inventory.receive` through the compatibility resolver.

Once a Position is migrated, `inventory.receive` must be granted explicitly. A migrated Position does not inherit receive authority from its legacy `v2Role`.

Platform ADMIN and SUPERADMIN retain system authority through the centralized resolver.

## Client surface

The Position form exposes `รับสินค้าเข้าสต๊อก` under the inventory capability group. Position names are never mapped to this capability.

## Out of scope

Wave 2D intentionally does not migrate:

- Purchase Order approval or procurement authority
- Purchase Receipt creation/finalization authority outside stock-item intake routes
- Quick Stock / Quick Receipt session authority
- Price or cost authority
- Stock adjustment or transfer semantics beyond capabilities already migrated in Wave 2B
- Stock Audit semantics beyond capabilities already migrated in Wave 2C
- Stock sale/deletion/status lifecycle mutations
- Tax, Finance, Repair, Communication, or Store Experience authority

## Verification target

Focused verification should include:

- `tests/employee-position-first-authority.contract.test.js`
- `src/modules/inventory/stock-item/shared/stockItemAuthorization.test.js`
- `src/modules/inventory/stock-item/stockItemSlices.test.js`
- `tests/simple-receive-authority.test.js`
- `scripts/verify-employee-lifecycle-runtime.js`
- full repository certification

No Prisma schema change or migration is required for Wave 2D.
