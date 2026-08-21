# Wave 3F — Supplier Advance Position Authority

## Scope

Move Supplier Advance authorization from hard-coded OWNER/MANAGER role checks to Position-first capability authority while preserving existing financial and branch-domain rules.

Surface:

- `GET /api/supplier-advances`
- `POST /api/supplier-advances`
- `POST /api/supplier-advances/:advanceId/apply`
- `POST /api/supplier-advances/:advanceId/activate`
- `POST /api/supplier-advances/:advanceId/void`

## Fresh archaeology

Before this wave, `supplierAdvanceRoutes.js` authenticated with `verifyToken` and then inspected `role`, `employeeRole`, `v2Role`, and `position` directly.

Historical authority:

- OWNER / MANAGER: list, create, apply
- OWNER only: activate legacy advance, void advance
- ADMIN / SUPERADMIN: platform override
- CASHIER / TECHNICIAN: denied

The service/repository already own the financial invariants, positive branch/actor identifiers, supplier/payable scope, allocation validation, transaction boundary, void reason, and legacy activation semantics.

## Capability model

Wave 3F introduces three stable capabilities:

- `procurement.supplier-advance.read`
- `procurement.supplier-advance.manage`
- `procurement.supplier-advance.control`

`control` is intentionally business-oriented rather than exposing a legacy-specific capability. It represents elevated control over an advance, covering exceptional certification/activation and voiding.

Route matrix:

- list: READ
- create: READ + MANAGE
- apply: READ + MANAGE
- activate legacy: READ + MANAGE + CONTROL
- void: READ + MANAGE + CONTROL

## Compatibility

When `positionCapabilities` is `null`/missing, legacy behavior remains:

- OWNER: READ + MANAGE + CONTROL
- MANAGER: READ + MANAGE
- CASHIER: none
- TECHNICIAN: none

When `positionCapabilities` is any array, including `[]`, the Position is authoritative.

ADMIN and SUPERADMIN retain all Position capabilities through centralized system-role authority.

## Boundary ownership

Route middleware owns feature authorization.

The controller remains responsible only for projecting authenticated branch/employee context into the service.

The service/repository continue to own financial validation, transaction boundaries, branch/supplier/payable isolation, allocation semantics, legacy activation rules, and void rules.

No Prisma migration is required.

## Client

Position configuration exposes the three Supplier Advance capabilities as a dedicated capability group. This does not alter Supplier Advance business UI behavior; it only makes the new Position authority assignable.

## Suggested local verification

Server:

```powershell
node src/modules/procurement/advances/http/supplierAdvanceAuthorization.test.js
node tests/employee-position-first-authority.contract.test.js
npm run test
npx prisma validate
```

Client:

```powershell
npx vitest run tests/position-supplier-advance-authority-ui.contract.test.js
npx vitest run tests/position-first-authority-ui.contract.test.js
npx vitest run tests/partner-store-employee-onboarding-ui.contract.test.js
npm run typecheck
npm run build
```
