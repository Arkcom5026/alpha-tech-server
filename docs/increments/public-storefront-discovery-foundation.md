# Public Storefront Discovery Foundation

## Mission

Extend the runtime-owned public storefront module on current `main` so the approved Commerce chain starts with customer-safe discovery:

```text
Public Discovery
→ Anonymous Shopping Session
→ Identity at Commitment
→ Server Revalidation
→ ProductReservation
```

## Architecture Decision

The latest `main` already owns public storefront runtime under:

```text
src/modules/sales/storefront/public/
```

This increment therefore extends that module instead of introducing a parallel `discovery/` owner.

## Delivered Scope

- public storefront detail by slug
- public product search and pagination scoped to one storefront branch
- public product detail scoped to one storefront branch
- active storefront, product, price, taxonomy, and date-window policy
- customer-safe product, taxonomy, image, price, and availability projection
- repository contract evidence

## Public Endpoints

```text
GET /api/sales/storefronts/:slug
GET /api/sales/storefronts/:slug/products?q=&page=&pageSize=
GET /api/sales/storefronts/:slug/products/:productId
```

## Compatibility

- additive extension of current runtime owner
- no duplicate route module
- no employee/POS API changes
- no stock mutation
- no cart/session mutation
- no customer identity authority
- no reservation creation
- no Prisma schema or migration changes
- no cost, supplier, margin, internal stock-item, or purchase-history exposure

## Verification Boundary

Repository review and source contracts are separate from executable runtime, database, operational, deployment, and production verification.
