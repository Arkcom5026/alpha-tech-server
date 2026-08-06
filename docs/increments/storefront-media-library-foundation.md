# Storefront Media Library Foundation

## Mission

Expose a trusted, branch-scoped media listing authority so a merchant can reuse previously uploaded storefront images without uploading the same file again.

## Scope

- Authenticated employee-only list endpoint under `/api/store-experience/media`
- Server derives `branchId` from verified employee/user context
- List only assets under `stores/branch-<branchId>/...`
- Optional purpose filter: `STORE_LOGO`, `STORE_COVER`, `STORE_HERO`, `STORE_PROMOTION`
- Cursor/page-size bounded listing
- Normalized asset response: provider, publicId, secureUrl, width, height, bytes, format, resourceType, purpose, createdAt
- Contract tests for branch isolation, purpose filtering, pagination limits, and provider-error normalization

## Non-goals

- No Prisma model or migration
- No persistent platform media catalogue
- No delete/destroy endpoint
- No cross-branch or platform-wide browsing
- No provider credentials in responses
- No crop, resize, watermark, AI processing, recycle bin, or version history
- No BYOS implementation in this increment

## Authority

- Client must never submit or override `branchId`
- Cloudinary resource prefix is derived only by the Server
- Only image resources owned by the current branch prefix may be returned
- Provider failures are normalized without exposing secrets

## Paired client work

The client increment adds a merchant media picker that lists these assets and binds a selected `secureUrl` into the existing storefront draft fields. Upload-new remains available through the existing upload authority.

## Workflow

Assistant changes feature branches only. The user performs local two-repository verification, merges into local `main`, verifies again, and pushes `main`.