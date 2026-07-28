# POS Sale Root Adapter Removal

## Mission

Remove the remaining root compatibility adapters for the active POS Sale runtime and mount the canonical Sales module router directly from `server.js`.

## Weight / Priority

This is the highest-weight remaining POS root cleanup because `/api/sales` and `/api/sale-orders` are central POS entrypoints. The actual handlers already live under `src/modules/sales`; the root files are now compatibility-only adapters.

## Scope

Allowed:

- `controllers/saleController.js`
- `routes/saleRoutes.js`
- `server.js` sale route import only
- this increment record

Forbidden:

- Prisma schema or migrations
- Sales business logic redesign
- POS held-cart behavior changes
- Payment, refund, sale-return, customer-deposit, tax, or Online commerce changes
- edits inside canonical Sales slices unless required by direct mount evidence

## Architecture Goal

- `server.js` imports `src/modules/sales/routes/saleRoutes` directly
- remove root `controllers/saleController.js`
- remove root `routes/saleRoutes.js`
- preserve both public mounts:
  - `/api/sales`
  - `/api/sale-orders`

## Verification Boundary

Repository inspection and diff-scope verification only. Runtime, build, tests, database execution, and operational verification remain deferred by user authority.
