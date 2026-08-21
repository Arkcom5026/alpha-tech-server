# Position Authority Wave 2C — Inventory Audit

## Scope

Wave 2C migrates the stock-count / stock-audit runtime boundary to Position capabilities without changing stock-count business rules, persistence semantics, or inventory quantities by itself.

In scope:

- stock audit access and counting authority
- stock audit finalization authority
- Position capability configuration in the client
- legacy `v2Role` compatibility while `Position.capabilities` is `NULL`

Out of scope:

- procurement receiving
- Quick Stock / Quick Receipt
- SIMPLE adjustment and transfer (completed in Wave 2B)
- structured stock mutation
- pricing
- repair
- tax
- finance
- sales
- any unrelated parallel agenda

## Capabilities

- `inventory.audit`
  - read active audit session
  - start a stock-count session
  - read overview/items
  - scan barcode / serial during counting
- `inventory.audit.finalize`
  - confirm audit results
  - cancel an audit session
  - runtime routes require both `inventory.audit` and `inventory.audit.finalize`

## Compatibility semantics

The Position-first migration contract remains unchanged:

- `Position.capabilities === null` means legacy compatibility mode.
- Existing legacy employee roles retain their pre-Wave-2C stock-audit behavior.
- An array (including `[]`) means the Position is authoritative.
- A migrated Position must explicitly contain `inventory.audit` to enter/count stock audit.
- A migrated Position must contain both audit capabilities to confirm or cancel a session.
- ADMIN / SUPERADMIN retain platform authority.

The compatibility mapping is temporary migration support; it is not the future business authority model.

## Runtime boundary

`stockAuditRoutes.js` remains authenticated by `verifyToken`, then applies capability middleware from `audit/shared/stockAuditAuthorization.js`.

This keeps business services focused on branch/session/inventory invariants while authorization is resolved before entering mutation handlers.

## Safety

No Prisma schema change or migration is introduced by Wave 2C. The wave reuses the nullable Position capability JSON introduced by Wave 1.

No inventory calculation, stock movement, audit reconciliation, or finalization strategy logic is modified.

## Verification

Focused local verification should include:

- `node tests/employee-position-first-authority.contract.test.js`
- `node src/modules/inventory/audit/shared/stockAuditAuthorization.test.js`
- relevant audit slice tests
- `node scripts/verify-employee-lifecycle-runtime.js`
- full `npm run test`
- `npx prisma validate`

Client verification should include the Position authority UI contract, onboarding compatibility contract, typecheck, and build.
