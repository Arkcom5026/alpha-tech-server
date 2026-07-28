# POS Refund Vertical Slice Migration

## Mission

Move the active POS refund transaction runtime from root type-based files into feature-owned vertical slices under `src/modules/sales/refund` while preserving the public API and existing behavior.

## Migration Classification

- Stage: LEGACY → MODULE-CANONICAL
- Production entrypoint: `/api/refunds`
- Module target: `src/modules/sales/refund`
- Workflow checkpoint: Create refund transaction and refresh Sale Return refund summary
- Files allowed: refund controller, refund route, server composition, module-owned files, increment record
- Files forbidden: Prisma schema, migrations, unrelated sales/payment/return workflows, online commerce
- Refactor allowed: YES, behavior-preserving only
- Deletion allowed: YES, after module runtime is mounted
- Verification report path: this file and PR description

## Compatibility Contract

Preserve unchanged:

- `POST /api/refunds/create`
- `verifyToken` protection
- branch-scoped Sale Return lookup
- response status codes and Thai messages
- Decimal-safe amount and deduction handling
- Sale Return summary fields and status transition behavior

## Verification Boundary

Repository inspection and diff-scope verification only. Runtime, build, tests, and database execution remain deferred by user authority.
