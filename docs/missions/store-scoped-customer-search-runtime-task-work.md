# Store-Scoped Customer Search Runtime — Execution Mission

## Mission

Change only the authenticated store/branch customer-search read path so customer lookup is backed by `StoreCustomer` and is always restricted to the current authenticated branch.

## Parent Authority

This increment is stacked on:

```text
agent/store-customer-backfill-audit-foundation
```

The parent branch is the source of truth for the Store Customer Prisma and Backfill/Audit foundations.

## Authorized Runtime Surface

Only these endpoints are in scope:

```text
GET /api/customers/by-phone/:phone
GET /api/customers/by-name?q=
```

The implementation may modify only the files strictly required to move these two reads from `CustomerProfile` to `StoreCustomer`, plus one focused contract test and the package script needed to run it.

## Required Behavior

1. Require `req.user.branchId`.
2. Reject a missing/invalid branch context before querying.
3. Query `prisma.storeCustomer`, never `prisma.customerProfile`, for the two authorized endpoints.
4. Include `branchId` in every StoreCustomer query predicate.
5. Exclude inactive StoreCustomer records.
6. Phone lookup must match only normalized phone within the authenticated branch.
7. Name lookup must match `displayName` within the authenticated branch.
8. Preserve the existing response contract as far as the StoreCustomer model supports it.
9. Do not expose another branch's customer even when phone, name, email, or tax ID is identical.
10. Do not add a fallback to unscoped CustomerProfile lookup.

## Explicit Non-goals

- customer creation
- customer update
- `/api/customers/me`
- StoreCustomerIdentityLink creation or verification
- legacy backfill execution
- Repair/Claim/Sales/Service/POS consumer cutover
- frontend changes
- Prisma schema or migration changes
- dependency installation
- database execution
- production deployment

## Compatibility

The public JSON fields currently returned by the two search endpoints should remain compatible where data exists:

```text
id
name
phone
provinceCode
districtCode
subdistrictCode
addressDetail
email
type
companyName
taxId
creditLimit
creditBalance
postcode
customerAddress
```

`name` is projected from `StoreCustomer.displayName`.

`creditBalance` has no StoreCustomer source in the current foundation and must use an explicit compatibility value without querying CustomerProfile.

## Verification

Focused repository evidence must prove:

- both search handlers query `prisma.storeCustomer`
- both include authenticated `branchId`
- both enforce `active: true`
- phone search uses StoreCustomer phone
- name search uses StoreCustomer displayName
- neither search handler queries CustomerProfile
- create/update/me handlers remain outside the increment
- no Prisma schema or migration file is changed

Do not claim Runtime PASS without local execution evidence.
