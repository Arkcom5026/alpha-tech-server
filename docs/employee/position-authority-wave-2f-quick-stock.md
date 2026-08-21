# Position Authority Wave 2F — Quick Stock One-Shot Mutations

## Scope

Wave 2F moves only the one-shot Quick Stock mutation surface to Position capability authority.

Capability:

- `inventory.quick-stock`

Guarded routes:

- `POST /api/quick-stock/quick-enroll`
- `POST /api/quick-stock/all-in-one`
- `POST /api/quick-stock/existing`

The dropdown/read surface remains under the existing authenticated employee-context boundary.

## Explicitly out of scope

Quick Receipt Session is intentionally not migrated in this wave. The following remain on their existing authority boundary and require a separate archaeology-led wave:

- list/detail receipt sessions
- create/update receipt sessions
- add/delete session items
- complete/finalize/cancel receipt sessions

This separation avoids coupling Quick Stock one-shot intake authority to the resumable Quick Receipt workflow, which also participates in cost/price and finalization authority.

## Compatibility semantics

Position authority follows the established migration contract:

- `Position.capabilities === null`: legacy `v2Role` compatibility applies.
- `Position.capabilities` is an array, including `[]`: Position is authoritative.
- `ADMIN` / `SUPERADMIN`: system authority still grants registered capabilities.

Before this wave, every authenticated employee context admitted by `allowQuickStockForEmployeeContext` could execute the one-shot mutations. Therefore legacy OWNER, MANAGER, CASHIER and TECHNICIAN all retain `inventory.quick-stock` during compatibility mode so migration does not silently remove existing access.

Once a Position is migrated, `inventory.quick-stock` must be present explicitly.

## Price authority remains separate

Quick Stock all-in-one and existing-product receive still use their existing actor/price authority and validation. This wave does not replace or weaken those controls; the Position capability is an additional business-operation boundary before the existing controller/service checks.

## UI

The Position capability surface adds:

- `เพิ่มสต๊อกด่วน`

The description makes clear that this covers Quick Stock one-shot operations and does not include Quick Receipt Session.

## Verification

Focused server checks:

```bash
node src/modules/product/quickStock/shared/quickStockAuthorization.test.js
node src/modules/product/quickStock/routes/quickStockRoutes.test.js
node tests/employee-position-first-authority.contract.test.js
node scripts/verify-employee-lifecycle-runtime.js
```

Full server gate:

```bash
npm run test
npx prisma validate
```

Client checks:

```bash
npx vitest run tests/position-first-authority-ui.contract.test.js
npx vitest run tests/partner-store-employee-onboarding-ui.contract.test.js
npm run typecheck
npm run build
```

No Prisma schema or migration is introduced by Wave 2F.
