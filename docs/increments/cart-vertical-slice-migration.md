# Cart Vertical Slice Migration

## Mission

Migrate the active Cart runtime from the root type-based structure into feature-owned vertical slices under `src/modules/cart` while preserving current public API behavior.

## Current runtime authority

`server.js`
→ `/api/cart`
→ `routes/cartRoutes.js`
→ `controllers/cartController.js`
→ Prisma

## Target runtime authority

`server.js`
→ `/api/cart`
→ `src/modules/cart/routes/cartRoutes.js`
→ feature-owned Cart slices
→ Prisma

## Planned slices

- `query/get`
- `query/branch-prices`
- `add`
- `remove`
- `clear`
- `merge`
- `update`
- `routes`
- module-local shared numeric helpers

## Compatibility boundary

The following public paths and current behavior must remain unchanged:

- `GET /api/cart`
- `POST /api/cart/items`
- `DELETE /api/cart/items/:productId`
- `POST /api/cart/clear`
- `POST /api/cart/merge`
- `PATCH /api/cart/item/:productId`
- `GET /api/cart/branch-prices/:branchId`

Authentication remains `verifyToken` at router scope. Prisma schema, persistence models, pricing policy, and Sales/POS Held Cart are out of scope.

## Verification boundary

Repository inspection and diff-scope verification only in this phase. Runtime, build, and tests remain deferred by user authority.
