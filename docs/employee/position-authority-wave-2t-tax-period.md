# Position Authority Wave 2T — Tax Period Administration

## Scope

Wave 2T migrates the core Tax Period administration surface from hard-coded employee roles to Position-first capabilities.

Covered routes:

- `GET /periods`
- `GET /periods/summary`
- `GET /periods/:taxPeriodId`
- `POST /periods/ensure`
- `POST /periods/:taxPeriodId/close`
- `POST /periods/:taxPeriodId/lock`
- `POST /periods/:taxPeriodId/submit`
- `POST /periods/:taxPeriodId/reopen`

The surrounding tax-period router also mounts Accounting Office Package, Tax Closing Handoff, Unified Tax Readiness, VAT Settlement, VAT Carry Forward, and Withholding Tax surfaces. Those are deliberately outside Wave 2T and remain candidates for later archaeology.

## Capabilities

- `tax.period.read` — list, summary, and detail reads for tax periods.
- `tax.period.manage` — ensure a monthly period and perform normal close/lock/submit transitions.
- `tax.period.reopen` — elevated reopen authority. Reopen requires both `tax.period.manage` and `tax.period.reopen`.

## Compatibility

The old Tax Period controller allowed platform `ADMIN`/`SUPERADMIN` and legacy employee `OWNER`/`MANAGER` only.

Wave 2T preserves that boundary while Position migration is incomplete:

- `OWNER` / `MANAGER`: all three Tax Period capabilities through legacy fallback.
- `CASHIER` / `TECHNICIAN`: no Tax Period capabilities through legacy fallback.
- `ADMIN` / `SUPERADMIN`: all capabilities through system-role authority.
- A non-null `Position.capabilities` array is authoritative, including an empty array.

## Architectural change

The hard-coded OWNER/MANAGER check is removed from `taxPeriodController.resolveBranchId`. Route middleware now owns operation authority through the shared Position capability resolver.

Branch isolation remains in the controller. Existing service invariants remain unchanged, including:

- tax-period transition graph;
- output draft guard before close;
- output/input filing completeness before lock;
- both output and input filing submission before period submission;
- VAT settlement readiness before period submission;
- stale-version and replay handling.

## Exclusions

Wave 2T does not change:

- Accounting Office package authority;
- Tax Closing Handoff authority;
- Unified Tax Readiness authority;
- VAT Settlement authority;
- VAT Carry Forward authority;
- Withholding Tax authority;
- Input Tax policy migrated in Wave 2R;
- Output Tax Filing authority migrated in Wave 2S;
- Delivery Note lifecycle.

No Prisma migration is required.

## Local verification

Recommended focused gates:

```bash
node src/modules/tax/periods/taxPeriodAuthorization.test.js
node scripts/verify-tax-authority-runtime.js
node scripts/verify-employee-lifecycle-runtime.js
```

Then run the normal full server certification and Prisma validation before publication.
