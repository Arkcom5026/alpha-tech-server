# Platform Customer Governance & Superadmin Workspace

## Status
OPEN — Step 1 Domain Contract / Step 2 Read-only Overview

## Domain Contract

- `User` is the platform identity.
- `CustomerProfile.branchId = <store>` is a store-owned customer relationship.
- `CustomerProfile.branchId = null` is an unassigned/legacy relationship and is not a platform customer.
- A future platform customer relationship must be created explicitly from platform-owned commerce. It must not be inferred from `branchId = null`.

## Superadmin Read Authority

The initial workspace may read:

- platform identity fields: id, loginId, email, enabled, createdAt, lastLoginAt;
- number of store customer profiles;
- store relationship identifiers and store names;
- number of unassigned legacy profiles.

The initial workspace must not expose by default:

- store sales history;
- deposits, debts, credit balances, or receipts;
- repair/service history;
- mutation, merge, reassignment, or deletion actions.

## Initial API

`GET /api/platform/customers/overview?q=&limit=`

Authority: `SUPERADMIN` only.
Mode: read-only.
