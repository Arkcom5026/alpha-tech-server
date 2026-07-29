# Public Storefront — Current-main Reconstruction

## Mission

Reconstruct the public, read-only, single-store product discovery projection on top of current `main` after Partner Store Capability Foundation was merged through PR #79.

## Authority Chain

- Issue #71 — Commerce Platform Foundation
- Issue #90 — current agenda
- PR #79 — merged Partner Store Capability persistence/runtime authority
- PR #91 — current Draft Working Area
- PR #72 — historical implementation and contract evidence only
- PR #48 — historical product-decision evidence only

## Increment Policy

```text
One increment = one branch = one Draft PR
```

Branch:

```text
feature/public-storefront-current-main-reconstruction
```

Bootstrap main SHA:

```text
ccb34a71a95753946fef6b55d5054d7055e83316
```

Repository implementation SHA:

```text
737df48875262e837d6329d59b1ae268aace03d6
```

## Product Direction

```text
Public Discovery
→ Anonymous Shopping Session
→ Identity at Commitment
→ Server Revalidation
→ ProductReservation
```

This increment owns only **Public Discovery**.

## Implemented Runtime

```text
GET /api/sales/storefronts/:slug
```

Authority path:

```text
Public Route
→ Controller
→ Service Policy
→ Repository Projection
→ Prisma / current database authorities
```

Runtime files:

```text
src/modules/sales/storefront/public/publicStorefrontRoutes.js
src/modules/sales/storefront/public/publicStorefrontController.js
src/modules/sales/storefront/public/publicStorefrontService.js
src/modules/sales/storefront/public/publicStorefrontRepository.js
```

The route is public, unauthenticated, read-only, and mounted before the existing session, identity, and commitment storefront routes.

## Projection Authorities

- PartnerStoreCapability
- PartnerStoreServiceArea
- Branch
- Product
- ProductImage
- BranchPrice.priceOnline
- StockBalance quantity/reserved

## Publication Policy

A storefront is discoverable only when its capability is enabled and its slug matches.

A product is published only when:

- product is active
- branch price is active
- `priceOnline` exists and is greater than zero
- effective date has started or is unset
- expiry date has not passed or is unset

Availability is derived from current stock balance as:

```text
max(quantity - reserved, 0)
```

The exact value remains internal. Customers receive only:

```text
AVAILABLE
OUT_OF_STOCK
```

## Customer-safe Contract

The projection exposes:

- storefront slug
- display name with Branch fallback
- customer-safe phone and address
- pickup discovery policy
- delivery discovery policy
- active service areas when `ADMIN_AREAS` is used
- product id and name
- online price
- cover image
- warranty days
- qualitative availability

The projection does not expose:

- internal branch ID
- internal capability ID
- exact stock quantity
- cost or average cost
- supplier data
- employee data
- mutable transaction authority

## Architecture Boundary

The storefront is a query projection, not a transaction aggregate.

This increment does not create or mutate:

- Anonymous Shopping Session
- Cart
- OrderOnline
- ProductReservation
- Sale
- Payment
- Inventory

Existing Session, Identity, Commitment, legacy Cart, and OrderOnline runtime ownership remains intact.

## Repository Contract Authority

Focused verification:

```text
npm run test:public-storefront
```

The contract verifies:

- package script wiring
- public route mount
- existing Session/Identity/Commitment route preservation
- no authentication middleware on discovery route
- slug validation and not-found policy
- Partner Store Capability authority reuse
- Product, Price, Image, and Stock projection reuse
- publication filters
- qualitative availability
- customer-safe field exclusions
- read-only repository behavior
- no legacy Cart, OrderOnline, or ProductReservation coupling

## Current Changed Files

```text
docs/increments/public-storefront-current-main-reconstruction.md
package.json
server.js
src/modules/sales/storefront/public/publicStorefrontController.js
src/modules/sales/storefront/public/publicStorefrontRepository.js
src/modules/sales/storefront/public/publicStorefrontRoutes.js
src/modules/sales/storefront/public/publicStorefrontService.js
tests/public-storefront-product-discovery.contract.test.js
```

## Reconstruction Policy

PR #72 was materially diverged and modified outdated `server.js` ownership. It remains closed without merge.

Only targeted semantics were reconstructed:

- public route contract
- repository query intent
- customer-safe projection semantics
- focused contract intent

No wholesale merge, rebase, branch retarget, or history import occurred.

## Explicit Non-goals

- Anonymous Shopping Session implementation
- Anonymous Cart
- Customer Identity or OTP
- ProductReservation creation
- Checkout or payment
- Marketplace aggregation
- Merchant fulfillment UI
- Sale conversion
- Legacy OrderOnline replacement

## Gate State

### Repository Gate

```text
Current-main reconstruction: COMPLETE
Targeted changed-file scope: PASS
Public Route → Controller → Service → Repository: IMPLEMENTED
Partner Store Capability authority reuse: IMPLEMENTED
Customer-safe response boundary: IMPLEMENTED
Publication and availability policy: IMPLEMENTED
Existing storefront transaction routes preserved: PASS
Focused repository contract: COMPLETE
Repository Implementation: COMPLETE
```

### Runtime Gate — Owner Authority

```text
Focused test execution: PENDING
Representative published storefront request: PENDING
Unpublished and invalid slug behavior: PENDING
Product publication filters: PENDING
Availability projection behavior: PENDING
Exact tested SHA: PENDING
Runtime Gate: PENDING
```

### Operational Gate — Owner Authority

```text
Open storefront URL without login: PENDING
Browse customer-safe products: PENDING
Verify price, image, fulfillment, and availability display: PENDING
Operational Gate: PENDING
```

## Current State

```text
Agenda: OPEN
Repository working area: PR #91 OPEN / DRAFT
Repository Implementation: COMPLETE
Branch compared with main: AHEAD 8 / BEHIND 0
Runtime Gate: PENDING — OWNER AUTHORITY
Operational impact: NONE
Production impact: NONE
```

## Remaining Agenda Before Merge

1. Project owner runs `npm run test:public-storefront` against the final remote SHA.
2. Project owner verifies representative public endpoint behavior without authentication.
3. Record exact tested SHA and evidence in PR #91.
4. Integrate newer `main` only if the base advances before merge.
5. Mark ready and merge only under explicit owner authorization.
6. Do not deploy without separate authorization.
