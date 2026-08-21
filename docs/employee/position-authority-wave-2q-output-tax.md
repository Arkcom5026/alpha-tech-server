# Position Authority Wave 2Q — Output Tax

## Scope

Wave 2Q migrates the core output-tax HTTP surface from hard-coded OWNER/MANAGER checks to Position-first capabilities while preserving existing branch isolation and the current tax engine.

## Capabilities

- `tax.output.read` — list tax candidates/documents and view document detail/printable output.
- `tax.output.prepare` — register generic/sale tax candidates and refresh a draft recipient snapshot.
- `tax.output.issue` — issue an output tax document.
- `tax.output.credit-note` — issue output-tax credit notes, including credit-note issuance from Sale Return.
- `tax.output.lifecycle` — transition an existing tax document through the canonical lifecycle.

## Compatibility

Legacy compatibility intentionally preserves the previous OWNER/MANAGER-only boundary for these routes. CASHIER and TECHNICIAN do not inherit these capabilities. ADMIN/SUPERADMIN retain system authority. A non-null Position capability array is authoritative, including an empty array.

## Boundary decisions

This wave changes authorization only. It does not alter tax candidate persistence, document lifecycle rules, atomic issuance, credit-note eligibility, output VAT publication, idempotency, or branch scoping.

The statutory presentation route remains outside this capability gate because it historically used authenticated-only access and does not pass through the former OWNER/MANAGER controller guard.

Input-tax routes, issuer-profile routes, output filing, tax publication retry, receipt-link decisions, and Delivery Note lifecycle are explicitly outside this wave and require separate archaeology before migration.

## Verification

Focused verification:

```powershell
node src/modules/tax/authorization/outputTaxAuthorization.test.js
node tests/tax-intake-http.contract.test.js
node scripts/verify-tax-authority-runtime.js
```

Then run the full server certification and `npx prisma validate` before publication.
