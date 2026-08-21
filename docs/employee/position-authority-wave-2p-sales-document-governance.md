# Position Authority Wave 2P — Sales Document Governance

## Scope

Wave 2P migrates the remaining sales-document preparation and replacement surfaces from authenticated-only access to Position-first capabilities while preserving legacy compatibility.

Delivery Note remains explicitly out of scope because its lifecycle is being developed in parallel and must not be coupled to this wave.

## Capabilities

- `sales.document.prepare`
  - create/read document-preparation draft
  - edit preparation lines
  - edit legacy sale document lines/descriptions
- `sales.document.lock`
  - lock a document-preparation snapshot when combined with `sales.document.prepare`
  - lock a replacement snapshot when combined with `sales.document.replace`
- `sales.document.replace`
  - create/read/edit document replacements under the existing financial lock
- `sales.document.tax-publish`
  - register tax candidates from document preparation when combined with `sales.document.prepare`

## Compatibility

The affected routes were previously protected only by `verifyToken`, so `OWNER`, `MANAGER`, `CASHIER`, and `TECHNICIAN` retain all four capabilities while `Position.capabilities` is `null`.

Once a Position has a non-null capability array, including `[]`, the Position becomes authoritative and only explicitly selected capabilities apply.

`ADMIN` and `SUPERADMIN` retain system-role authority.

## Runtime boundaries

- Preparation create/read/edit requires `sales.document.prepare`.
- Preparation lock requires both `sales.document.prepare` and `sales.document.lock`.
- Tax-candidate registration requires both `sales.document.prepare` and `sales.document.tax-publish`.
- Replacement create/read/edit requires `sales.document.replace`.
- Replacement lock requires both `sales.document.replace` and `sales.document.lock`.
- Delivery Note routes remain unchanged and do not use Wave 2P guards.
- Quotation reference, Sale Return, payment, settlement, tax lifecycle, and sales completion authorities remain unchanged.

## Business invariants preserved

Wave 2P does not change document preparation or replacement services. Existing branch scoping, source-sale checks, financial locks, immutable snapshots, idempotent replay, tax projection, replacement lineage, and transaction behavior remain authoritative.

No Prisma schema or migration is required.
