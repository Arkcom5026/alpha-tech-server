# POS Payment Vertical Slice Migration

## Mission

Move the active POS payment runtime from root type-based structure into feature-owned vertical slices under `src/modules/sales/payment` while preserving existing API and runtime behavior.

## Migration Classification

- Stage: HYBRID → MODULE-FIRST
- Production entrypoint: `server.js` → `/api/payments` → `routes/paymentRoutes.js`
- Module target: `src/modules/sales/payment`
- Workflow checkpoint: POS payment posting, printable payment search, payment cancellation
- Files allowed:
  - `controllers/paymentController.js`
  - `routes/paymentRoutes.js`
  - `server.js` payment import only
  - `src/modules/sales/payment/**`
  - this increment record
- Files forbidden:
  - Prisma schema/migrations
  - sale creation runtime
  - refund and sale-return flows
  - customer deposit domain redesign
  - tax/document redesign
  - unrelated root files
- Refactor allowed: YES, behavior-preserving only
- Deletion allowed: YES, only after direct module mount and reference inspection
- Verification report path: this file and Draft PR description

## Why This Increment Has POS Weight

`controllers/paymentController.js` is an active POS authority. It owns:

- payment posting for a sale;
- payment method validation;
- branch-scoped payment-code generation;
- deposit consumption integration;
- sale payment-status projection;
- printable-payment search;
- payment cancellation.

The controller already depends on `src/modules/sales/completion/services/salePaymentPostingService`, so it is a high-value HYBRID boundary ready for controlled migration.

## Planned Vertical Slices

- `create/`
- `query/printable/`
- `cancel/`
- `code/`
- `shared/`
- `routes/`

## Compatibility Contract

Preserve unchanged:

- `POST /api/payments`
- `GET /api/payments/printable`
- `POST /api/payments/cancel`
- `verifyToken` protection
- response status codes and messages
- payment code format
- transaction semantics
- existing sale/deposit integration

## Risk Controls

- Do not redesign payment policy during structural migration.
- Do not move unrelated sale completion logic.
- Keep each operation owned end-to-end within its slice.
- Remove root files only after `server.js` mounts the module router directly and repository references are safe.

## Verification Boundary

Repository inspection and diff-scope verification only. Build, tests, database execution, and operational smoke tests remain deferred by user authority.
