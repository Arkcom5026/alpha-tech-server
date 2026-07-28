# Inventory Hybrid State Elimination

## Current bounded increments

1. Retire orphan inventory controller/service/repository/router stack.
2. Move SIMPLE stock HTTP ownership into `src/modules/inventory/simple-stock`.
3. Move Stock Item HTTP ownership and receive payload normalization into `src/modules/inventory/stock-item`.
4. Move Inventory Dashboard route composition into `src/modules/inventory/dashboard`.
5. Audit SIMPLE adjustment and transfer as canonical movement writers.

## Compatibility policy

Root-level files mounted by `server.js` remain thin adapters until server composition is migrated in a separately controlled increment. Public endpoint paths and current handler behavior are preserved.

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

Disposition: no separate generic movement controller should be introduced. Movement is a persisted domain record owned by the operation that causes it. A future movement history/query capability may read these records, but must not become an alternate write authority.

## Audit hold: legacy Quick Receipt

`/api/quick-receipts` remains mounted through `routes/quickReceiptRoutes.js`, but repository search found no frontend consumer. Its controller is an inline Knex/table implementation (`quick_receipts`, `quick_receipt_items`, `stock_balances`, `barcodes`) and does not use the current Prisma inventory authority. It must not be mechanically moved into the canonical module.

Required disposition before removal or redesign:

- confirm production/runtime usage;
- confirm whether the referenced Knex connection and tables exist;
- compare with the current Quick Receipt / urgent receiving workflow;
- choose explicit retirement or a new Prisma-backed vertical slice.

Until those checks are complete, this legacy endpoint remains unchanged and is recorded as a known hybrid risk.

## Verification boundary

Repository inspection can establish ownership and reference safety only. Server bootstrap, verifier execution, database behavior, and authenticated operational smoke tests remain local/runtime gates.
