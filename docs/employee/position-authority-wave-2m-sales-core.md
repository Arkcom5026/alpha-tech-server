# Position Authority Wave 2M — Sales Core

## Scope

This wave migrates only the operational sales core boundary to Position-first authority.

Capabilities:

- `sales.core`
  - POS held carts
  - sale item search
  - legacy sale create
  - sale list/history, printable search, return-history read
  - sale detail read
- `sales.complete`
  - sale completion only
  - completion requires both `sales.core` and `sales.complete`

## Why completion is separate

`POST /api/sales/complete` is not a normal CRUD action. The completion service is the commitment boundary that can persist the sale, consume inventory, post payment evidence, preserve quotation lineage, create delivery-note presentation evidence, and publish a tax candidate. A Position that can browse or prepare a sale therefore does not automatically receive completion authority.

## Compatibility

Before this wave, the selected core routes were protected only by `verifyToken`. To avoid changing current production behavior while Position migration is incomplete, legacy/null-Position compatibility grants both `sales.core` and `sales.complete` to existing employee roles:

- OWNER
- MANAGER
- CASHIER
- TECHNICIAN

When `Position.capabilities` is a non-null array, Position is authoritative. An empty array therefore means no migrated sales authority. ADMIN and SUPERADMIN retain system authority.

## Explicit exclusions

This wave intentionally does **not** place the new core guard over adjacent authority domains:

- Quotation routes
- Sale Return routes
- `mark-paid` settlement route
- document preparation/replacement routes
- delivery-note/document-line mutation routes

Those paths have separate money, return, tax/document, or workflow semantics and must be migrated after their own archaeology instead of inheriting `sales.core` accidentally.

## Route boundary

Core access is applied individually in `src/modules/sales/routes/saleRoutes.js` so that nested Quotation and Return routers remain independent.

Completion uses an AND boundary:

`verified employee + sales.core + sales.complete + existing completion business guards`

Existing branch/customer/idempotency/inventory/payment/tax/quotation behavior inside completion remains unchanged.

## Verification

Focused local checks:

```powershell
node src/modules/sales/shared/salesAuthorization.test.js
node scripts/verify-employee-lifecycle-runtime.js
```

Then run the repository certification suite and Prisma validation before publication.

Client verification should include the Position UI contract, onboarding compatibility contract, typecheck, and production build.
