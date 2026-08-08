# Storefront Media Metadata & Safe Management Foundation

## Mission

Extend the branch-scoped storefront media library with searchable provider metadata and usage authority so merchants can understand which assets are safe to manage before any destructive action is introduced.

## Scope

- Authenticated employee-only metadata/list authority.
- Derive `branchId` from verified employee/user context only.
- Restrict all provider queries to `stores/branch-<branchId>/...`.
- Search by public-id fragment within the current branch scope.
- Filter by purpose: `STORE_LOGO`, `STORE_COVER`, `STORE_HERO`, `STORE_PROMOTION`.
- Normalize provider metadata: dimensions, bytes, format, created time, provider, public id, secure URL.
- Classify whether each asset is referenced by the current Draft and/or Published Snapshot.
- Return safe-management flags such as `inUse`, `usedByDraft`, `usedByPublished`, and `deletable=false` while destructive authority is not yet enabled.
- Bounded pagination and provider-error normalization.
- Contract tests.

## Out of scope

- No Cloudinary destroy/delete call.
- No bulk delete.
- No Prisma or migration in this increment.
- No folders, tags, crop, resize, transformations, or BYOS settings.
- No client-supplied branch ownership.

## Safety invariants

1. A merchant must never see metadata from another branch.
2. Published references must be reported distinctly from Draft references.
3. Assets referenced by either snapshot cannot be represented as safe to delete.
4. Provider errors must not expose credentials or internal secrets.
5. This increment is read-only management authority.

## Paired client work

Client branch: `feature/storefront-media-metadata-management-foundation`

## Architecture agenda

Server Issue #317 — Storage Provider Abstraction Foundation.

## Integration authority

Assistant pushes feature branches only. The user performs local two-repository verification, merges into local `main`, verifies again, and pushes `main`.
