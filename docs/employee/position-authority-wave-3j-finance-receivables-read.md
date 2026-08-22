# Wave 3J — Finance Receivables Read Position Authority

## Scope

Wave 3J migrates the read-only Finance Runtime surfaces for accounts receivable and customer credit from authenticated-only access to Position-first authority.

Covered routes:

- `GET /api/finance/ar/summary`
- `GET /api/finance/ar`
- `GET /api/finance/customer-credit/summary`
- `GET /api/finance/customer-credit`
- `GET /api/finance/customer-credit/:customerId`

`GET /api/finance/ping` remains an authenticated diagnostic and is intentionally not treated as receivables business authority.

## Capability

- `finance.receivables.read`

One read capability intentionally covers both AR and customer-credit projections because they are two views of the same branch-scoped receivables authority and are served by the same Finance Runtime module.

## Compatibility

The historical routes were authenticated-only. During migration, legacy employee roles `OWNER`, `MANAGER`, `CASHIER`, and `TECHNICIAN` therefore retain read access through the compatibility resolver.

A non-null Position capability array is authoritative, including an empty array. Migrated Positions must contain `finance.receivables.read` explicitly.

`ADMIN` and `SUPERADMIN` remain all-capability platform actors.

## Authority boundary

Route middleware owns feature authorization. The controller continues to require the authenticated branch identity, while the service/repository retain query normalization, customer validation, and branch-scoped persistence reads.

No Prisma migration is required.
