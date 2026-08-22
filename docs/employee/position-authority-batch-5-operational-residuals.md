# Position-first Authority — Batch 5 Operational Residuals

## Scope

Batch 5 groups three remaining operational authority surfaces so they can be verified and published together instead of opening one Local/Publish cycle per endpoint:

1. Communication
2. Store Experience / Storefront draft + media + publish lifecycle
3. Product Trace

This batch starts from server `main` `8dbd9e33f3c68f8cb965119e0e493ffaf1a314a2` and client `main` `d2823dcbc2350072835b814c12e354ddaa955bdb`.

No Prisma schema or migration is required.

## Position capabilities

### Communication

- `communication.operate`
- `communication.profile.manage`

`communication.operate` owns ordinary branch communication work: customer channels, repair communication preferences and activities, and communication reads. Branch profile mutation additionally requires `communication.profile.manage`.

Legacy compatibility:

- OWNER / MANAGER: operate + profile management
- CASHIER / TECHNICIAN: operate only
- generic legacy employee context: operate only
- ADMIN / SUPERADMIN: all
- migrated non-null Position capability arrays are authoritative, including `[]`

## Store Experience

- `store-experience.read`
- `store-experience.manage`
- `store-experience.publish`

Route split:

- read draft/media: READ
- save draft / upload media: READ + MANAGE
- publish / unpublish: READ + MANAGE + PUBLISH

Historical Store Experience routes allowed employee context broadly, so OWNER / MANAGER / CASHIER / TECHNICIAN retain all three through compatibility fallback. Migrated Positions must opt in explicitly.

## Product Trace

- `product.trace.read`
- `product.trace.financials`

Employee Product Trace access becomes Position-first while preserving the pre-existing non-employee authenticated trace behavior.

Compatibility:

- OWNER / MANAGER: trace read + financial visibility
- CASHIER / TECHNICIAN: trace read only
- ADMIN / SUPERADMIN: both
- migrated non-null Position arrays are authoritative, including `[]`
- authenticated non-employee trace behavior remains unchanged and does not receive employee financial visibility

Supplier and financial projections continue to follow the financial visibility authority.

## Architecture

`employeeOperationalPositionAuthority.js` is a domain extension under the employee authorization boundary. It reuses the central `resolveActorCapabilities()` mode decision so Position arrays keep the same authoritative null/non-null semantics as the rest of the Position-first program. It owns only the compatibility mapping for the operational capability family.

Feature modules remain responsible for domain-specific combinations:

- Communication policy combines operate + profile-manage where needed.
- Store Experience route middleware owns read/manage/publish boundaries.
- Product Trace policy owns read/financial projection decisions.

No controller/service/repository business semantics are moved into the authorization layer.

## Verification target

Server focused verification should cover:

- `employeeOperationalPositionAuthority.test.js`
- `communicationAccessPolicy.test.js`
- `storeExperienceAuthorization.test.js`
- `productTracePolicy.test.js`
- Position-first authority regression
- full server certification
- Prisma validate

Client verification should cover:

- `position-operational-residual-authority-ui.contract.test.js`
- Position-first UI regression
- adjacent recent Position capability contracts
- typecheck
- production build

Batch status remains **IMPLEMENTED / AWAITING LOCAL VERIFICATION** until the Local gate passes.
