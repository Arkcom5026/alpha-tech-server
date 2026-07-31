# Customer Runtime Migration Audit — 2026-07-31

## Decision

The next highest-weight backend migration target is the Customer module.

## Why Customer Has the Highest Weight

Customer is a cross-domain identity and transaction dependency used by sales, repair, warranty, deposits, reservations, tax documents, and online account flows. The current module route is already centralized, but runtime ownership is still controller-heavy and persistence-aware.

Current files:

```text
src/modules/customer/routes/customerRoutes.js
src/modules/customer/controllers/customerQueryController.js
src/modules/customer/controllers/customerCreateController.js
src/modules/customer/controllers/customerUpdateController.js
src/modules/customer/shared/customerControllerSupport.js
```

## Current Runtime Capabilities

```text
GET  /api/customers/by-phone/:phone
GET  /api/customers/by-name
GET  /api/customers/me
POST /api/customers
PUT  /api/customers/me
PUT  /api/customers/:id
```

## Current Ownership Findings

### Query controller

`customerQueryController.js` directly owns:

- authentication/branch policy
- request normalization
- Prisma queries
- branch-safe sale-history filters
- response projection
- HTTP error mapping

### Create controller

`customerCreateController.js` directly owns:

- phone validation
- existing-user conflict rules
- password hashing
- subdistrict/postcode validation
- Prisma transaction orchestration
- customer projection
- HTTP response mapping

### Update controller

`customerUpdateController.js` directly owns:

- role and branch authorization
- customer type validation
- subdistrict/postcode validation
- profile mutation and phone mutation transactions
- online profile upsert
- response projection
- Prisma error mapping

## Architectural Risk

The controller layer currently accesses Prisma directly in all three workflow groups. This creates broad ownership, repeated mapping code, repeated address projection logic, and high regression risk around tenant isolation and identity updates.

Target architecture:

```text
Route
→ Slice Controller
→ Slice Service
→ Slice Repository
→ Prisma
```

## Recommended Migration Order

Each capability must be an independently deployable increment.

1. **Customer Query by Phone Slice**
   - preserves branch authority through sale history
   - preserves phone validation and response projection

2. **Customer Query by Name Slice**
   - preserves branch-scoped search and limit semantics

3. **Customer Self Query Slice**
   - preserves CUSTOMER-only identity authority

4. **Customer Create Slice**
   - preserves login conflicts, password foundation, postcode validation, transaction boundary, and existing-profile replay

5. **Staff Customer Update Slice**
   - preserves role/branch ownership and phone transaction semantics

6. **Customer Self Update Slice**
   - preserves CUSTOMER-only upsert behavior

7. **Legacy Controller Retirement**
   - only after zero runtime references and full certification

## Compatibility Locks

- no endpoint or HTTP method changes
- no frontend changes
- no Prisma schema or migration changes during slice extraction
- existing Thai error messages and status codes remain stable
- branch isolation may not be weakened
- phone-based identity conflict behavior remains stable
- response shapes remain stable
- transaction boundaries remain atomic

## First Increment Recommendation

Start with **Customer Query by Phone Slice** because it is small enough to certify independently but carries high business weight: it is a common customer lookup path and includes branch-isolation semantics that must become explicit module policy.

## Verification Gate

For each increment:

```text
focused contract
→ module tests
→ full certification
→ startup verification
→ operational endpoint verification
```

No legacy deletion is allowed until repository search and executable zero-reference evidence both pass.
