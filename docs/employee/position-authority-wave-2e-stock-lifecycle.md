# Position Authority Wave 2E — Stock Item Lifecycle

## Scope

Wave 2E continues the Position-first authority migration inside Inventory by moving manual Stock Item lifecycle mutations behind a stable Position capability.

Capability introduced:

- `inventory.lifecycle`

Covered HTTP mutations:

- `DELETE /api/stock-items/:id`
- `PATCH /api/stock-items/:id/status`

The sales-owned `PATCH /api/stock-items/mark-sold` endpoint is intentionally NOT guarded by `inventory.lifecycle` in this wave. Its SOLD transition belongs to the sale completion/inventory commitment path and must not be coupled to a manual stock-maintenance capability.

## Authority semantics

The existing Position migration semantics remain binding:

- `Position.capabilities === null` means the position has not migrated yet, so the server uses `v2Role` compatibility.
- `Position.capabilities` as any array, including `[]`, means Position is authoritative.
- Platform `ADMIN` and `SUPERADMIN` remain privileged through centralized system authority.
- Position display names never grant permissions.

Because these manual lifecycle routes were previously protected only by authentication and branch scope, legacy OWNER, MANAGER, CASHIER and TECHNICIAN compatibility all retain `inventory.lifecycle` until their Position is explicitly migrated. This avoids a silent loss of existing access during the migration.

Once a Position has migrated, `inventory.lifecycle` must be assigned explicitly. `inventory.receive` does not imply lifecycle authority, and lifecycle authority does not imply receive authority.

## Route boundary

`src/modules/inventory/stock-item/shared/stockItemAuthorization.js` remains the Stock Item capability middleware. It now exposes:

- `STOCK_ITEM_CAPABILITY.RECEIVE`
- `STOCK_ITEM_CAPABILITY.LIFECYCLE`

Receive-denial error compatibility is preserved as `STOCK_ITEM_RECEIVE_FORBIDDEN`. Lifecycle denial uses `STOCK_ITEM_LIFECYCLE_FORBIDDEN`.

## Client configuration

The Position form adds a Stock capability option:

- `จัดการสถานะรายการสต๊อก`

This represents manual status changes and deletion of unsold stock records. The wording explicitly excludes normal SOLD transitions performed by the sales flow.

## Out of scope

Wave 2E does not migrate:

- sales completion / mark-sold authority
- stock-item query/read authority
- Procurement / Purchase Order authority
- Quick Stock / Quick Receipt authority
- pricing or cost authority
- Tax, Finance, Repair or Communication authority

No Prisma schema or migration is required; this wave uses the existing nullable `Position.capabilities` JSON authority surface.

## Verification targets

Server focused verification:

- `node tests/employee-position-first-authority.contract.test.js`
- `node src/modules/inventory/stock-item/shared/stockItemAuthorization.test.js`
- `node src/modules/inventory/stock-item/stockItemSlices.test.js`
- `node scripts/verify-employee-lifecycle-runtime.js`
- `npm run test`
- `npx prisma validate`

Client focused verification:

- `npx vitest run tests/position-first-authority-ui.contract.test.js`
- `npx vitest run tests/partner-store-employee-onboarding-ui.contract.test.js`
- `npm run typecheck`
- `npm run build`
