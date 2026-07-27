# Product Vertical Slices Integration Status

Branch: `integration/product-vertical-slices-main`

## Scope

- Product module route authority moved to `src/modules/product/routes/productRoutes.js`.
- Legacy `routes/productRoutes.js` is a compatibility shim.
- POS query, online query, runtime lookup, template clone, ready-to-sell, inventory lookup, and POS create compatibility are capability-owned slices.
- Broad Operational Product Runtime Controller and Service are removed.
- Quick Receipt and Tax certification scripts from the integration base are preserved.

## Repository Gate

The branch includes:

- `tests/product-vertical-slice-integration.contract.test.js`
- `tests/product-inventory-runtime-contract.test.js` updated for slice ownership
- `npm run verify:product-backend-migration`

Repository commands have not been executed in a runtime-capable environment in this session.

## Merge Authority

Do not merge until all conditions are met:

1. Reconcile the branch with the latest `main` because `main` advanced during integration.
2. Run `npm run verify:product-backend-migration`.
3. Run the full backend certification suite.
4. Start the backend successfully.
5. Verify Product POS search, online search, runtime-by-template, create-local, create-from-template, ready-to-sell, and Quick Receipt flows.

## Gate Status

- Repository structure: prepared
- Runtime Gate: pending
- Operational Gate: pending
- Main merge: not authorized yet
