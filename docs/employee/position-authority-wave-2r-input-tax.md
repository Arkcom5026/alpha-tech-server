# Position Authority Wave 2R — Input Tax

## Scope

Wave 2R migrates the existing centralized Input Tax access policy from hard-coded employee roles to Position capabilities while preserving all Input Tax domain behavior and branch/actor guards.

## Capabilities

- `tax.input.read` — VIEW and EXPORT operations.
- `tax.input.review` — REVIEW, duplicate/replacement decisions, and investigation resolution.
- `tax.input.filing` — select/remove filing documents and file a batch.
- `tax.input.audit` — generate audit packages.
- `tax.input.period-control` — reopen or otherwise perform privileged tax-period control currently represented by `REOPEN_PERIOD`.

## Compatibility

- `SUPERADMIN` / `ADMIN`: system authority, all capabilities.
- Legacy `OWNER` / `MANAGER`: retain all historical Input Tax authority while migration is in progress.
- Legacy `CASHIER` / `TECHNICIAN`: remain denied, matching the previous hard-coded policy.
- Migrated Position with non-null `capabilities`: Position is authoritative, including an empty array.

## Preserved boundaries

This wave does not change Input Tax business rules, filing eligibility, duplicate/replacement logic, period rules, audit generation, branch isolation, actor requirements, or response contracts.

It does not modify Output Tax, issuer profile, publication retry, Delivery Note, or tax-document issuance flows.

## Verification

Focused verification should include:

```text
node src/modules/tax/policies/inputTaxAccessPolicy.test.js
node scripts/verify-tax-authority-runtime.js
node scripts/verify-employee-lifecycle-runtime.js
npm run test
npx prisma validate
```

Client verification should include the Position-first authority contract, onboarding compatibility contract, typecheck, and production build.
