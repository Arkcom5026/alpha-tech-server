# Storefront Media Upload Authority

## Mission

Provide an authenticated, branch-scoped image upload endpoint for Store Experience media without reusing the legacy product upload-only endpoint as tenant authority.

## Discovery evidence

The repository already includes Cloudinary, Multer, streamifier, and an image-only 5 MB memory upload middleware. The legacy product upload runtime uploads into the shared `products` folder and its upload-only path does not derive tenant ownership from the authenticated employee session. It is therefore unsuitable as the authority for multi-tenant storefront media.

## Scope

- Authenticated employee-only endpoint under `/api/store-experience/media`
- One image per request
- Allowed purposes:
  - `STORE_LOGO`
  - `STORE_COVER`
  - `STORE_HERO`
  - `STORE_PROMOTION`
- Server-derived `branchId` from the verified employee context
- Cloudinary path scoped by branch and purpose
- MIME and 5 MB size validation
- Normalized response containing `secureUrl`, `publicId`, dimensions, bytes, MIME type, provider, purpose, and branch ownership
- Contract tests for routing, tenant authority, path policy, and validation

## Folder policy

`stores/branch-<branchId>/<purpose-lowercase>/<generated-id>`

The client may select a media purpose but may never submit authoritative branch ownership or provider credentials.

## Draft and publish lifecycle

Uploading creates an external media object and returns its normalized URL. The Store Experience editor writes that URL only into the current draft. The Public Storefront continues using the published snapshot until the merchant explicitly publishes the draft.

## Excluded

- Prisma persistence
- Media asset registry
- Merchant Cloudinary credentials
- Quota accounting
- Product image migration
- Automatic deletion of replaced images
- Crop or transformation editor

These remain under Architecture Issue #317 and require separate evidence and migration authority.

## Security gates

- `verifyToken` must execute before Multer and upload handling.
- Employee context must be required.
- `branchId` must be read from verified request context only.
- Unknown purpose, absent file, non-image MIME, or oversized payload must fail closed.
- Provider errors must not expose credentials.

## Integration

This server branch is paired with client branch `feature/storefront-media-upload-foundation`. Both branches remain unmerged until local two-repository verification passes. The user retains local merge and `main` push authority.