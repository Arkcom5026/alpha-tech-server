# Address Runtime Migration Audit

Status: DISCOVERY COMPLETE — IMPLEMENTATION NOT STARTED

## Mission

Audit the remaining legacy address runtime before selecting the next safe vertical-slice migration increment.

This audit follows Alpha-Tech Module Migration Standard v1:

- migrate by domain workflow ownership, not by file length
- one feature owns HTTP → Controller → Service → Repository → Prisma
- one production endpoint has one runtime owner
- hybrid states are allowed only when ownership remains explicit
- legacy retirement requires zero runtime references
- repository evidence must precede implementation decisions

## Current Production Entrypoints

`server.js` mounts two live aliases:

```text
/api/address   → src/modules/location/routes/addressRoutes.js
/api/locations → src/modules/location/routes/locationsRoutes.js
```

Both aliases currently expose the remaining utility endpoints:

```text
GET  /resolve
GET  /validate
GET  /postcode
GET  /search
POST /join
```

Therefore, migrating only `addressRoutes.js` would leave the same legacy handlers active through `/api/locations`. Any runtime cutover must account for both route graphs in the same increment.

## Existing Module-Owned Runtime

The canonical `/api/address` lookup lists are module-owned:

```text
GET /api/address/provinces
GET /api/address/districts
GET /api/address/subdistricts
```

Ownership:

```text
addressRoutes
→ addressListController
→ addressListService
→ addressListRepository
→ Prisma
```

However, `/api/locations` still implements its lookup-list endpoints inline with direct Prisma access. This is a separate hybrid runtime concern and must not be silently conflated with the remaining utility-handler migration.

## Remaining Legacy Runtime Owners

Legacy source:

```text
controllers/addressController.js
```

Live route owners:

```text
src/modules/location/routes/addressRoutes.js
src/modules/location/routes/locationsRoutes.js
```

Both route files import the root legacy controller for:

```text
resolve
validate
postcode
search
join
```

## Capability and Dependency Map

### 1. Resolve

```text
GET /api/address/resolve
GET /api/locations/resolve
```

Input:

```text
subdistrictCode required
address optional
postalCode optional
```

Data access:

```text
Prisma subdistrict.findUnique
include district → province
```

Domain dependency:

```text
addressUtil.joinAddress
```

Behavioral contracts:

- 400 when `subdistrictCode` is missing
- 404 when the subdistrict does not exist
- response includes province/district/subdistrict codes and Thai names
- caller-supplied `postalCode` overrides stored postcode
- `fullAddress` is produced when `address` or resolved postal code exists
- known Prisma errors map to the existing 400 fallback
- unknown errors map to the existing 500 payload

External consumer discovered:

```text
alpha-tech-client/src/features/address/api/addressApi.js
```

The client probes `/address/resolve` first and normalizes several compatibility shapes. The canonical current backend shape must remain unchanged.

### 2. Validate

```text
GET /api/address/validate
GET /api/locations/validate
```

Input:

```text
subdistrictCode required
```

Data access:

```text
Prisma subdistrict.findUnique
```

Response:

```json
{ "valid": true }
```

This is a small independent query capability with no domain formatter dependency.

### 3. Postcode

```text
GET /api/address/postcode
GET /api/locations/postcode
```

Input:

```text
subdistrictCode required
```

Data access:

```text
Prisma subdistrict.findUnique
```

Behavioral contracts:

- 400 when code is missing
- 404 when code is unknown
- response is `{ postalCode: valueOrNull }`

Although it shares persistence access with Validate, its not-found and response contracts differ. It must not be grouped with Validate merely because both query the same table.

### 4. Search

```text
GET /api/address/search
GET /api/locations/search
```

Input:

```text
q optional
```

Behavior:

- missing or shorter-than-two-character query returns empty arrays without persistence access
- otherwise searches province, district, and subdistrict concurrently
- each result group is capped at 10 and sorted by Thai name ascending

This is a standalone multi-aggregate query capability.

### 5. Join

```text
POST /api/address/join
POST /api/locations/join
```

Input:

```text
address optional
subdistrictCode required
postalCode optional
```

Current dependency path:

```text
Legacy Controller
→ addressUtil.getAdmFromSubdistrictCode
→ Prisma
→ addressUtil.joinAddress
```

This endpoint does not directly own persistence access today; the root utility does. Migrating Join requires an explicit decision about whether ADM lookup becomes slice repository ownership or remains a temporary legacy utility dependency. It must not be treated as a simple controller extraction.

## Utility Audit

Legacy utility:

```text
utils/address.js
```

Exports:

```text
joinAddress
getAdmFromSubdistrictCode
buildBranchAddress
```

Repository search found `addressUtil` references only in the legacy address controller and this utility file. `buildBranchAddress` has no discovered external reference.

Architectural classification:

- `joinAddress`: pure formatting primitive; candidate for module-local/shared primitive only after ownership is established
- `getAdmFromSubdistrictCode`: persistence-bearing legacy domain helper; not a neutral primitive
- `buildBranchAddress`: apparently unused compatibility helper; retirement requires a stronger zero-reference guard before deletion

No utility retirement is authorized in the first runtime-cutover increment.

## Critical Discovery

There are two mounted address route graphs, not one:

```text
/api/address
/api/locations
```

Both expose the remaining legacy handlers. Consequently:

```text
Route cutover is complete only when both aliases use the same module-owned slice.
```

Migrating one alias alone would create dual runtime ownership and would violate the migration standard.

## Minimum Safe Next Increment

Recommended next increment:

```text
Address Resolve Query Slice
```

Endpoint scope:

```text
GET /api/address/resolve
GET /api/locations/resolve
```

Target structure:

```text
src/modules/location/address/query/resolve/
  addressResolveController.js
  addressResolveService.js
  addressResolveRepository.js
```

Ownership:

```text
Both route aliases
→ addressResolveController
→ addressResolveService
→ addressResolveRepository
→ Prisma
```

The service may call a pure address formatter, but the repository must own ADM persistence access.

## Locked Non-Changes for Resolve Increment

- no URL or alias removal
- no query-name change
- no response-key change
- no status-code change
- no Thai message change
- no postal-code precedence change
- no `fullAddress` condition change
- no Prisma schema or migration change
- no frontend change
- no refactor of Validate, Postcode, Search, or Join
- no deletion of the root controller or utility

## Required Contract Guards

The Resolve increment must prove:

- both route files import the new resolve controller
- neither route calls `addressController.resolve`
- slice controller does not access Prisma
- slice service does not access Prisma
- slice repository owns `subdistrict.findUnique`
- the exact include graph remains district → province
- response projection and error messages remain stable
- remaining legacy handlers stay routed as before

## Retirement State After Resolve Cutover

Expected controlled hybrid state:

```text
Resolve        → module-owned through both aliases
Validate       → legacy-owned
Postcode       → legacy-owned
Search         → legacy-owned
Join           → legacy-owned
Address lists  → mixed alias state remains separately visible
```

`addressController.resolve` may be removed only after repository-wide zero-reference verification and a retirement contract. That retirement decision should be explicit rather than bundled accidentally into the runtime cutover.

## Verification Plan

After implementation:

```text
focused resolve migration contract
module tests
full certification
prestart database foundations
server startup
operational requests against both aliases
```

PASS claims must be tied to the exact branch head SHA.
