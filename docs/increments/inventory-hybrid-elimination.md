# Inventory Hybrid State Elimination

## Current bounded increments

1. Retire orphan inventory controller/service/repository/router stack.
2. Move SIMPLE stock HTTP ownership into `src/modules/inventory/simple-stock`.
3. Move Stock Item HTTP ownership and receive payload normalization into `src/modules/inventory/stock-item`.
4. Move Inventory Dashboard route composition into `src/modules/inventory/dashboard`.

## Compatibility policy

Root-level files mounted by `server.js` remain thin adapters until server composition is migrated in a separately controlled increment. Public endpoint paths and current handler behavior are preserved.

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
