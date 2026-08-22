# Position-first Authority — Residual Business Batch A

Status: IMPLEMENTED ON FEATURE BRANCH / NOT YET LOCALLY VERIFIED OR PUBLISHED

Branch: `feature/employee-position-authority-batch-residual-business-a`

Base: server `8dbd9e33f3c68f8cb965119e0e493ffaf1a314a2`

## Scope

This batch removes residual hardcoded employee-role authority from three adjacent business surfaces while preserving historical compatibility during migration:

1. Communication
2. Product Trace
3. Store Experience / Storefront Draft + Media

## Capabilities

- `communication.access`
- `communication.profile.manage`
- `product.trace.read`
- `product.trace.financial`
- `store-experience.read`
- `store-experience.manage`
- `store-experience.publish`

## Compatibility contract

`positionCapabilities` remains authoritative whenever it is an array, including `[]`.

Platform `ADMIN` / `SUPERADMIN` retain all capabilities in this batch.

Legacy compatibility while `positionCapabilities` is null/missing:

- OWNER / MANAGER: all seven capabilities.
- CASHIER / TECHNICIAN: communication access, product-trace read, and all historical Store Experience operations.
- CASHIER / TECHNICIAN do not gain communication-profile management or product-trace financial visibility.

This preserves the old route behavior while allowing migrated Positions to become explicit authority.

## Route / policy ownership

Communication policy owns communication capability evaluation. Existing employee-context and branch guards remain unchanged.

Product Trace keeps its existing branch-scoped lookup and response redaction model. Position capability only replaces the old OWNER/MANAGER financial visibility check for employee actors; historical non-employee authenticated compatibility is preserved.

Store Experience routes now own feature authority explicitly:

- GET draft / media list => READ
- PUT draft / media upload => READ + MANAGE
- publish / unpublish => READ + PUBLISH

Controllers and services continue to own branch/domain behavior.

## Schema

No Prisma migration is required.

## Verification before publication

Run focused authority tests for the residual authority helper, communication, product trace, and Store Experience, then the server certification suite and Prisma validate. Client must run the residual capability UI contract, Position-first regression contracts, typecheck, and production build before merge/publish.
