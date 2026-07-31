# Receipt Module Import Guard Fix — 2026-07-31

## Scope

Correct the stale procurement receipt module import test after receipt routes became module-canonical.

## Runtime Authority

`server.js` currently imports:

```text
src/modules/procurement/receipt/routes/purchaseOrderReceiptRoutes.js
src/modules/procurement/receipt/routes/purchaseOrderReceiptItemRoutes.js
```

The test still referenced removed root legacy route paths.

## Change

Update only `src/modules/procurement/receipt/receiptModuleImports.test.js` to require the canonical module route files.

## Non-Changes

- no endpoint change
- no route implementation change
- no controller/service/repository change
- no Prisma change
- no frontend change
- no production deployment
