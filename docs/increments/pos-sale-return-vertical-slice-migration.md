# POS Sale Return Vertical Slice Migration

## Mission

Migrate the active POS Sale Return runtime from root type-based files into feature-owned vertical slices under `src/modules/sales/return` while preserving public API and behavior.

## Selection Authority

Among the remaining POS root files inspected, `controllers/saleReturnController.js` carries the highest immediate migration weight: 241 lines, three active handlers, branch-scoped reads, Decimal projections, and direct coordination with the existing canonical Sale Return mutation module.

## Migration Classification

- Stage: HYBRID → MODULE-FIRST
- Production entrypoint: `server.js` → `/api/sale-returns` → `routes/saleReturnRoutes.js`
- Module target: `src/modules/sales/return`
- Workflow checkpoint: Sale Return create, list, and detail
- Files allowed:
  - `controllers/saleReturnController.js`
  - `routes/saleReturnRoutes.js`
  - `server.js` Sale Return import only
  - `src/modules/sales/return/**`
  - this increment record
- Files forbidden:
  - Prisma schema/migrations
  - refund transaction behavior
  - payment runtime
  - sale creation/completion behavior
  - Online commerce
  - unrelated root files
- Refactor allowed: YES, behavior-preserving only
- Deletion allowed: YES, only after direct module mount and reference inspection
- Verification report path: this file and Draft PR description

## Compatibility Contract

Preserve unchanged:

- `POST /api/sale-returns/create`
- `GET /api/sale-returns`
- `GET /api/sale-returns/:id`
- `verifyToken` protection
- branch scoping
- response status codes and Thai messages
- Decimal-safe refund summary projections

## Verification Boundary

Repository inspection and diff-scope verification only. Runtime, build, tests, and database execution remain deferred by user authority.
