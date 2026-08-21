# Wave 3G — Supplier Payable Position Authority

## Scope

This wave migrates the supplier payable and payable-dispute HTTP boundary from hard-coded OWNER/MANAGER checks to Position-first capability authority.

Affected API family:

- `GET /api/supplier-payables/candidates`
- `GET /api/supplier-payables/aging`
- `GET /api/supplier-payables/disputes`
- `GET /api/supplier-payables`
- `POST /api/supplier-payables/from-receipts`
- `POST /api/supplier-payables/:payableId/disputes`
- `POST /api/supplier-payables/:payableId/adjustments`
- `POST /api/supplier-payables/disputes/:disputeId/resolve`
- `POST /api/supplier-payables/adjustments/:adjustmentId/void`

## Capabilities

- `procurement.supplier-payable.read`
- `procurement.supplier-payable.manage`
- `procurement.supplier-payable.control`

`read` owns payable/candidate/aging/dispute visibility.

`manage` owns creation of payable authority from receipts plus ordinary dispute and adjustment operations.

`control` is the elevated authority for reversing an adjustment. It intentionally replaces the old OWNER-only boundary without encoding a job title into the capability name.

## Route matrix

| Route family | Required capabilities |
| --- | --- |
| payable/candidate/aging/dispute reads | read |
| create payable from receipts | read + manage |
| open/resolve dispute | read + manage |
| create adjustment | read + manage |
| void adjustment | read + manage + control |

## Compatibility behavior

While Position migration remains in progress:

- legacy OWNER: read + manage + control
- legacy MANAGER: read + manage
- legacy CASHIER: none
- legacy TECHNICIAN: none
- ADMIN/SUPERADMIN: all capabilities

When `positionCapabilities` is a non-null array it is authoritative, including `[]`. No legacy role fallback is allowed for a migrated Position.

## Domain boundary

This wave changes authorization only. It does not move or duplicate payable business rules.

The existing services remain authoritative for:

- branch and employee actor validation
- receipt-backed payable creation
- supplier and receipt identity validation
- document and due-date validation
- dispute amount/reason validation
- adjustment type/direction/amount validation
- transaction boundaries
- adjustment void reason and repository constraints

## Data model

No Prisma schema or migration is required.
