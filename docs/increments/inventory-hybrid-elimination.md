# Inventory Hybrid State Elimination

## Current bounded increments

1. Retire orphan inventory controller/service/repository/router stack.
2. Move SIMPLE stock HTTP ownership into `src/modules/inventory/simple-stock`.
3. Move Stock Item HTTP ownership and receive payload normalization into `src/modules/inventory/stock-item`.
4. Move Inventory Dashboard route composition into `src/modules/inventory/dashboard`.
5. Audit SIMPLE adjustment and transfer as canonical movement writers.
6. Move Stock Audit routing into `src/modules/inventory/audit`.
7. Move Quick Receipt HTTP ownership and legacy persistence composition into `src/modules/inventory/quick-receipt` without redesigning persistence.
8. Mount Inventory routers directly from `server.js` and retire root-level compatibility adapters when reference-safe.

## Compatibility policy

`server.js` now mounts Inventory routers directly from `src/modules/inventory/*`. Public endpoint paths and current handler behavior remain preserved. Root-level Inventory adapters are retired only after repository reference inspection confirms that active runtime composition no longer depends on them.

## Current runtime ownership

The active Inventory route composition in `server.js` points directly to module-owned routers:

- Stock Item: `src/modules/inventory/stock-item/routes/stockItemRoutes`
- Stock Audit: `src/modules/inventory/audit/routes/stockAuditRoutes`
- Quick Receipt: `src/modules/inventory/quick-receipt/routes/quickReceiptRoutes`
- Inventory Dashboard: `src/modules/inventory/dashboard/routes/stockDashboardRoutes`
- SIMPLE Stock: `src/modules/inventory/simple-stock/routes/simpleStockRoutes`

Root-level adapters for these mounted surfaces are no longer runtime owners on this branch.

## Movement authority audit

Repository inspection confirms that SIMPLE adjustment and SIMPLE transfer already write stock movements inside module-owned Prisma transactions.

### Adjustment

- Validates branch authority and SIMPLE-product policy.
- Updates `StockBalance` and SIMPLE lots in one transaction.
- Writes `ADJUST` movements for every positive or negative lot change.
- Rejects quantity changes that would violate reserved stock or lot consistency.

### Transfer

- Uses a transfer key for replay/idempotency detection.
- Consumes source lots and creates destination lots in one transaction.
- Writes paired negative/positive `TRANSFER` movements.
- Updates both source and destination balances atomically.
- Rejects branch, product-identity, availability, and lot-consistency violations.

Disposition: no separate generic movement controller should be introduced. Movement is a persisted domain record owned by the operation that causes it. A movement history/query capability may read these records, but must not become an alternate write authority.

## Quick Receipt disposition

`/api/quick-receipts` is now owned under `src/modules/inventory/quick-receipt` and mounted directly by `server.js`.

The migration performed in this increment is structural only:

- HTTP routing and controller ownership are module-local.
- Service behavior is separated from persistence through `quickReceiptRepositoryContract.js`.
- Legacy Knex/table access is isolated in `legacy/quickReceiptRepository.js`.
- Legacy service/repository composition is isolated in `legacy/createLegacyQuickReceiptService.js`.
- Public endpoint paths and response behavior are preserved.

Persistence remains intentionally legacy-backed because no authoritative Prisma Quick Receipt model or migration exists in the inspected repository state. This increment does not invent a Prisma domain, create a migration, or claim persistence migration completion.

Required future disposition before removing the legacy persistence adapter:

- confirm production/runtime usage and referenced tables;
- establish an authoritative Prisma schema/migration contract;
- implement a replacement repository against that authority;
- switch composition only after runtime evidence;
- remove the legacy adapter only when no runtime reference remains.

## Remaining hybrid boundary

The remaining Quick Receipt legacy code is a bounded persistence adapter inside the correct module boundary, not root-level HTTP or business-logic ownership. Removing it is a separate persistence migration and must not be inferred as part of this structural increment.

## Verification boundary

Repository inspection can establish ownership and reference safety only. Server bootstrap, verifier execution, database behavior, and authenticated operational smoke tests remain local/runtime gates.
