# Position Authority Wave 3A — Tax Issuer Profile

## Scope

Wave 3A migrates the Tax Issuer Profile feature boundary from employee-role checks to Position capabilities.

In scope:

- `GET /api/tax/issuer-profile`
- `PUT /api/tax/issuer-profile`
- Position capability registry and legacy compatibility mapping
- Position configuration UI for the new capability family

Out of scope:

- Tax publication retry
- Statutory tax presentation
- Output-tax document issue/lifecycle authority already owned by earlier waves
- Prisma schema changes

## Capabilities

- `tax.issuer-profile.read`
- `tax.issuer-profile.manage`

Route semantics:

- GET requires `read`
- PUT requires both `read` and `manage`

This keeps profile mutation as an elevated action without allowing a manage-only position to bypass read authority.

## Compatibility

Legacy compatibility is intentionally preserved:

- OWNER: read + manage
- MANAGER: read + manage
- CASHIER: none
- TECHNICIAN: none
- ADMIN / SUPERADMIN: all capabilities through platform-role authority

For migrated Positions, any non-null `positionCapabilities` array is authoritative, including `[]`.

## Boundary ownership

The route middleware owns feature authorization.

The controller retains only domain/tenant authority:

- platform ADMIN/SUPERADMIN may target an explicit valid branch
- ordinary employees remain constrained to their authenticated branch
- cross-branch issuer-profile access remains forbidden
- missing branch authority continues to fail closed

The service and repository validation contracts remain unchanged.

## Verification

Focused verification should include:

- `node src/modules/tax/issuerProfile/taxIssuerProfileAuthorization.test.js`
- `node tests/tax-issuer-profile-runtime.contract.test.js`
- tax authority runtime verification
- employee lifecycle runtime verification
- full server certification
- Prisma validate

Client verification should include:

- `npx vitest run tests/position-tax-issuer-profile-authority-ui.contract.test.js`
- Position-first authority contract
- employee onboarding compatibility contract
- typecheck
- production build
