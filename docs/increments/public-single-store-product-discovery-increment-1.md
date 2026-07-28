# Public Single-store Product Discovery — Increment 1

## Mission

Establish the first customer-facing commerce increment for Alpha-Tech: a public, read-only, single-store product discovery projection that allows customers to browse a published storefront without authentication.

This increment follows the accepted product decision:

```text
Public Discovery
→ Anonymous Shopping Session
→ Identity at Commitment
→ Server Revalidation
→ ProductReservation
```

## Product Position

This increment implements only the first step: **Public Discovery**.

Customers should be able to open a store link or QR code and inspect products without logging in. Anonymous cart, OTP, commitment, reservation creation, tracking, payment, and marketplace behavior remain outside this increment.

## Existing Authority Reused

The projection must derive from existing runtime authorities rather than introducing a competing catalog:

- `PartnerStoreCapability` — current published storefront and fulfillment policy
- `Branch` — store identity and branch ownership
- `Product` — product identity and current product metadata
- `ProductImage` — product media
- `BranchPrice` — branch-owned current online price
- `StockBalance` / current inventory authority — availability projection

## Architecture Boundary

The storefront discovery surface is a **public query projection**, not a transaction aggregate.

It must not:

- create a `Storefront` aggregate
- create a `MerchantCatalog` transaction authority
- create a second product, price, or stock source of truth
- create or mutate `Cart`, `OrderOnline`, `ProductReservation`, `Sale`, or inventory
- accept client-supplied authority values
- require authentication

## Initial Query Contract

The first implementation should extend the existing public storefront projection so one store slug can return:

- customer-safe store information
- pickup and delivery policy summary
- published products for the selected branch
- primary and additional product images where available
- branch online price derived from active `BranchPrice.priceOnline`
- customer-safe availability state derived from current inventory authority

The contract should not expose:

- branch IDs
- internal capability IDs
- cost price
- employee information
- supplier information
- exact internal stock allocation details
- mutation authority
- unpublished or inactive products

## Availability Policy

Exact stock quantity is not assumed to be customer-visible in this increment.

Until Product Authority decides otherwise, the projection contract should support a customer-safe state such as:

- `AVAILABLE`
- `LOW_STOCK`
- `UNAVAILABLE`

The mapping threshold remains an implementation policy to be reviewed before runtime certification.

## Publication Eligibility

A product is eligible for public discovery only when all required current-authority conditions are satisfied, including at minimum:

- storefront is published
- product is active
- branch online price exists, is active, and is greater than zero
- product belongs to or is sellable by the selected branch under current product authority
- inventory policy allows online discovery

No new durable publication table is authorized by this document. If product-level publication control is later required, it must be introduced as a separate reviewed capability rather than inferred silently.

## Legacy Compatibility

`OrderOnline` and the account-bound legacy `Cart` are not part of this increment.

Their existing runtime behavior must remain unchanged. This increment must not expand `OrderOnline` into the public checkout authority and must not convert the legacy `Cart` into the anonymous shopping-session authority.

## Increment Delivery Shape

Expected implementation ownership:

```text
HTTP Public Route
→ Public Storefront Controller
→ Public Storefront Service
→ Public Storefront Repository
→ Existing Product / Price / Inventory Authorities
→ Customer-safe Projection
```

The existing `src/modules/sales/storefront/public/` slice should own this increment unless repository evidence proves a safer module boundary.

## Verification Gates

### Repository Gate

Required evidence:

- no competing commerce aggregate introduced
- public route remains unauthenticated and read-only
- customer-safe response contract
- branch/store slug scope enforced
- product, price, image, and inventory authority reuse proven
- legacy `OrderOnline` and Cart behavior unchanged
- contract tests added and wired
- `git diff --check` passes

### Runtime Gate

Required evidence:

- dependencies available
- relevant contract tests pass
- Prisma validation/generation only if Prisma is changed
- public storefront request executes against a representative database
- unpublished store and unavailable-product cases behave correctly

### Operational Gate

Deferred until the customer frontend exists. Required future evidence:

```text
Open store URL or QR
→ View store
→ Browse products without login
→ Inspect price, images, and availability
```

## Explicit Non-goals

- Anonymous shopping session
- Anonymous cart
- OTP or customer identity
- Reservation commitment
- ProductReservation creation
- customer tracking
- payment
- merchant fulfillment UI
- marketplace or multi-store search
- production deployment

## Adaptive Change Policy

This increment is intentionally adaptive rather than frozen. Product decisions may evolve while implementation proceeds.

Changes are acceptable when they:

- preserve the accepted authority boundaries
- remain additive or safely reversible
- do not introduce a competing transaction authority
- update this increment contract and tests together
- retain evidence for Repository, Runtime, and Operational Gates

## Authority

- Issue #69 remains Product Planning Authority.
- PR #48 remains Product Reservation Foundation Working Area and repository evidence.
- This increment document defines the implementation scope for the public single-store product discovery working area.
