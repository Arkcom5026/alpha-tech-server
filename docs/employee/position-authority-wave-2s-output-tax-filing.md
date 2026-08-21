# Position-first Authority Wave 2S — Output Tax Filing

## Scope

Wave 2S moves the sales/output-tax filing workspace from authenticated-only access to Position-first capability authority without changing filing business rules.

In scope:

- list output tax filing batches
- prepare a filing batch for a month
- submit/finalize a prepared filing batch

Out of scope:

- Output Tax document issuance/lifecycle (Wave 2Q)
- Input Tax policy and filing (Wave 2R)
- tax issuer profile
- publication retry
- statutory presentation
- Delivery Note lifecycle

## Capabilities

- `tax.output.filing.read`
- `tax.output.filing.prepare`
- `tax.output.filing.submit`

Submit requires both `tax.output.filing.prepare` and `tax.output.filing.submit` so a submit-only Position cannot finalize a draft it is not otherwise authorized to prepare/manage.

## Compatibility

The historical `/output-filings` surface was mounted only behind `verifyToken`, so all legacy employee roles (`OWNER`, `MANAGER`, `CASHIER`, `TECHNICIAN`) retain the three filing capabilities while Position migration is incomplete.

For migrated Positions, any non-null capability array is authoritative, including `[]`.

`ADMIN` and `SUPERADMIN` retain system authority through the centralized Position capability resolver.

## Preserved domain rules

This wave does not change:

- branch scoping (`req.user.branchId`)
- employee actor requirement for batch preparation
- filing period validation
- DRAFT/finalized conflict rules
- Output VAT record selection rules
- idempotent submitted-batch replay
- non-empty draft requirement before submission
- filing persistence or Prisma schema

No Prisma migration is required.
