# Online Store Published Snapshot Foundation

## Mission

Allow a merchant to edit and save storefront content while the currently published storefront remains publicly available and unchanged until an explicit publish command.

## Current blocker

`StoreExperienceProfile` currently stores editable and public values in the same row. The service rejects edits while status is `PUBLISHED`, and the public projection reads the same profile. This cannot support safe live editing.

## Authority boundaries

- Alpha-Tech owns platform theme, typography, spacing, components, layout behavior, and responsive rules.
- A merchant owns store identity and content only: logo, cover, banners, promotion media, text, section visibility, and section ordering.
- All records are isolated by authenticated `branchId`.

## Additive data contract

Extend `StoreExperienceProfile` with immutable-at-read published snapshot fields:

- `publishedThemePreset String?`
- `publishedThemeTokens Json?`
- `publishedLayoutPreset String?`
- `publishedSectionConfiguration Json?`
- `publishedContentConfiguration Json?`
- `publishedVersion Int?`

Add editable merchant content:

- `contentConfiguration Json?`

No existing column is removed or renamed.

## Lifecycle

### Save draft

- Allowed while storefront is DRAFT, READY, or PUBLISHED.
- Updates editable fields only.
- Must not change `storefrontEnabled`.
- Must not change published snapshot fields.
- Status remains PUBLISHED when an older snapshot is live.

### Publish

- Validate merchant content and enabled sections.
- Copy editable fields to published snapshot fields in one database transaction.
- Increment version and publishedVersion.
- Set `publishedAt`.
- Enable storefront capability.

### Public read

- Read published snapshot fields only.
- Never read unpublished editable fields when a published snapshot exists.
- If no snapshot exists, storefront is not publicly available.

### Unpublish

- Disable public storefront.
- Preserve editable draft and published snapshot for controlled republish/rollback work.

## Merchant content configuration v1

```json
{
  "identity": {
    "logoAssetId": null,
    "coverAssetId": null,
    "tagline": null,
    "shortDescription": null
  },
  "hero": {
    "desktopAssetId": null,
    "mobileAssetId": null,
    "eyebrow": null,
    "title": null,
    "description": null,
    "ctaLabel": null,
    "ctaTarget": null
  },
  "promotions": []
}
```

Asset IDs are references only. Binary upload/storage belongs to a later Media Library increment.

## Verification gates

- Prisma validate/generate.
- Additive migration inspection.
- Contract test: save while PUBLISHED does not mutate published snapshot.
- Contract test: publish copies draft to snapshot atomically.
- Contract test: public projection never exposes draft content.
- Contract test: branch isolation.
- Runtime verification on a separate test database before any production migration.

## Explicit non-scope

- Binary upload provider.
- Image transformation/CDN.
- Promotion pricing engine.
- Theme customization by merchants.
- Production migration apply.
