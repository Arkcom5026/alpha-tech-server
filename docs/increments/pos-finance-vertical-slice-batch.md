# POS Finance Vertical Slice Batch

## Mission

Batch-migrate multiple related POS finance runtimes from root type-based files into feature-owned modules before considering one production deployment.

## Batch policy

- One branch and one Draft PR for the related batch.
- Each sub-slice is committed independently and remains reversible.
- Do not mark ready or merge after each migrated file.
- Evaluate aggregate scope, runtime coupling, and deployment value before merge.

## Initial targets

1. Bank runtime
   - Root controller: `controllers/bankController.js`
   - Root route: `routes/bankRoutes.js`
   - Target: `src/modules/finance/bank/`

2. Supplier payment read compatibility runtime
   - Root controller: `controllers/supplierPaymentController.js`
   - Root route: `routes/supplierPaymentRoutes.js`
   - Target: `src/modules/procurement/supplier-payment/`
   - Mutation endpoints remain refusal/compatibility boundaries; no legacy write authority is restored.

## Compatibility requirements

- Preserve all existing public endpoints and HTTP methods.
- Preserve `verifyToken` protection.
- Preserve branch scope, status codes, and response messages.
- No Prisma schema, migration, or unrelated workflow change.

## Verification boundary

Repository inspection and diff-scope evidence only. Runtime, build, tests, and database execution remain deferred by user authority.

## Status

Draft batch working area. Do not merge until the batch has sufficient weight and has been reviewed as one deployable unit.
