# ProductTemplate Store Adoption Recovery

## Mission

Repair the Quick Receipt ProductTemplate adoption path so a store can clone a template product even when the corresponding store-owned ProductType has not been created yet.

## Production Evidence

- Target branch: `branchId = 14`
- Template product: `templateProductId = 265`
- Runtime result before this increment: `HTTP 400 PRODUCT_TYPE_NOT_FOUND_IN_BRANCH`
- Store 14 had only one ProductType (`globalProductTypeId = 2`), while the selected template required another global type.

## Product Decision

When cloning a ProductTemplate, the system must:

1. Reuse the store ProductType linked to the same `globalProductTypeId` when it exists.
2. Otherwise adopt the ProductType identity from Template Authority `T01` into the authenticated store.
3. Create the operational Product against the store-owned ProductType.
4. Never point a store Product directly at the Template Branch ProductType.
5. Keep ProductType adoption and Product creation in one transaction.
6. Preserve idempotent re-clone behavior.
7. Treat the adopted ProductType as store-owned data; later Template changes do not overwrite it automatically.

## Scope

- `src/modules/product/templateClone/services/productTemplateCloneService.js`
- `src/modules/product/templateClone/controllers/productTemplateCloneController.js`
- focused contract test

## Explicit Non-Changes

- No Prisma schema change
- No migration
- No Production data mutation in repository work
- No endpoint or success response contract change
- No Quick Receipt finalization change

## Verification Required

```text
node tests/product-template-store-adoption-recovery.contract.test.js
node tests/product-vertical-slice-integration.contract.test.js
npm run test:modules
npm test
```

Runtime verification must repeat `POST /api/products/pos/create-from-template` for a store that lacks the target ProductType and confirm:

- ProductType is adopted under the authenticated `branchId`
- operational Product is created against that ProductType
- repeated request returns the existing Product
- no ProductType or Product duplicate is produced
