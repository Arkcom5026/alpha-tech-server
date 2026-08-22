# Position Authority Batch 4B — Communication / Store Experience / Product Trace

## Scope

This grouped migration closes three operational role-policy residuals without changing domain persistence or branch isolation:

1. Communication
2. Store Experience / storefront draft and media
3. Product Trace visibility

No Prisma migration is required.

## Capabilities

### Communication

- `communication.view`
- `communication.profile.manage`

Compatibility:
- legacy authenticated employees keep communication access;
- legacy OWNER/MANAGER keep profile-management authority;
- migrated Position capability arrays are authoritative, including `[]`.

### Store Experience

- `store-experience.read`
- `store-experience.manage`
- `store-experience.publish`
- `store-experience.media`

Compatibility:
- historical employee-context access is preserved for legacy employees;
- platform admins remain authorized;
- migrated Positions must hold the explicit capability set required by each action.

Route split:
- GET draft/media => read
- PUT draft => read + manage
- POST publish/unpublish => read + publish
- POST media upload => read + media

### Product Trace

- `product.trace.read`
- `product.trace.financials`

Compatibility:
- historical authenticated trace access remains available in legacy compatibility mode;
- legacy OWNER/MANAGER retain financial/supplier visibility;
- migrated Position arrays become authoritative and may independently grant trace read and financial visibility;
- platform admins retain authority.

## Architecture

`operationalResidualAuthority.js` owns the Batch 4B capability vocabulary and delegates Position-vs-legacy mode detection to the existing employee Position authority foundation. This preserves the established rule:

- `positionCapabilities = null` => compatibility fallback
- `positionCapabilities = []` => migrated and explicitly has no capability
- non-empty Position arrays => explicit Position authority

`positionRuntimeService` accepts the Batch 4B capability vocabulary so Position create/update can persist the new capabilities.

## Verification

Focused server coverage:
- `src/modules/employee/authorization/operationalResidualAuthority.test.js`
- existing `src/modules/communication/communicationAccessPolicy.test.js`

Client contract:
- `tests/position-operational-residual-authority-ui.contract.test.js`

Full local certification remains required before integration into `main`.
