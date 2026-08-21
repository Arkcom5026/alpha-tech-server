# Position Authority Wave 3C — Statutory Tax Presentation

## Scope

Wave 3C closes the remaining authenticated-only statutory tax presentation read endpoint:

- `GET /api/tax/documents/:taxDocumentId/presentation`

The endpoint returns the immutable statutory presentation snapshot for a registered output tax document. It may call the idempotent presentation snapshot compatibility helper when an older registered document does not yet have a persisted presentation row.

## Authority decision

No new capability is introduced.

Statutory presentation is a read projection of the same registered output-tax document already protected by `tax.output.read`. Creating a missing deterministic presentation snapshot is compatibility persistence, not a new business mutation authority. A separate `tax.statutor...` capability would split one read responsibility without a distinct business boundary and would add unnecessary permission surface.

Therefore the route now reuses:

- `tax.output.read`

This keeps the statutory presentation endpoint aligned with:

- output-tax document list/detail reads;
- printable output-tax document reads;
- the existing Position capability configuration already exposed by the client.

## Compatibility semantics

The centralized Position authority remains authoritative:

- `positionCapabilities === null` => legacy `v2Role` compatibility applies;
- non-null capability arrays, including `[]`, are authoritative;
- legacy `OWNER` and `MANAGER` retain `tax.output.read`;
- legacy `CASHIER` and `TECHNICIAN` do not receive output-tax read authority;
- platform `ADMIN` / `SUPERADMIN` retain all capabilities.

## Boundary ownership

Route middleware owns feature authority:

```text
verifyToken
  -> allowOutputTaxRead
  -> getStatutoryTaxPresentation
```

The controller continues to own domain/tenant invariants only:

- authenticated branch is required;
- cross-branch presentation access is forbidden;
- positive tax-document identity is required;
- document lookup remains branch-scoped;
- only registered statutory tax documents can produce a statutory presentation snapshot.

No controller/service business semantics were changed.

## Client impact

No client code or new Position capability checkbox is required. `tax.output.read` is already present in the Position capability catalog, so adding a second statutory-presentation permission would be redundant.

## Persistence

No Prisma schema or migration change is required.

## Verification

Focused verification should include:

```powershell
node src/modules/tax/authorization/outputTaxAuthorization.test.js
node tests/statutory-document-presentation-wave4.contract.test.js
node scripts/verify-tax-authority-runtime.js
node scripts/verify-employee-lifecycle-runtime.js
npm run test
npx prisma validate
```
