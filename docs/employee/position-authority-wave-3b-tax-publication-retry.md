# Position Authority Wave 3B — Tax Publication Retry

## Scope

Wave 3B moves the tax publication retry surface from authenticated-only access to centralized Position-first capability authorization.

In scope:

- `GET /api/tax/publication/gaps`
- `POST /api/tax/publication/retry-sale/:saleId`
- `POST /api/tax/publication/retry-all`

Out of scope:

- output-tax document issue/lifecycle authority
- tax issuer profile authority
- statutory presentation snapshot authority
- publication retry business/service semantics
- Prisma schema changes

## Capabilities

- `tax.publication-retry.read`
- `tax.publication-retry.execute`

Route matrix:

| Route | Required capability |
| --- | --- |
| GET gaps | `read` |
| POST retry-sale | `read` + `execute` |
| POST retry-all | `read` + `execute` |

`execute` is intentionally elevated because retry commands may create missing tax publication side effects. The read capability alone can inspect publication gaps but cannot retry them.

## Compatibility

Historical access for this administrative tax recovery surface is preserved for legacy authority:

- OWNER: read + execute
- MANAGER: read + execute
- CASHIER: none
- TECHNICIAN: none
- ADMIN / SUPERADMIN: all capabilities

For migrated Positions, a non-null `positionCapabilities` array is authoritative. An explicit empty array remains no authority and does not fall back to legacy `v2Role`.

## Boundary ownership

The route middleware now owns feature authorization through `taxPublicationRetryAuthorization.js` and the centralized `employeePositionAuthority` capability resolver.

The publication retry routes continue to project authenticated `branchId` and `actorEmployeeId` into the existing services. No service or persistence semantics are changed in this wave.

## Verification

Focused server contract:

`node src/modules/tax/publicationRetry/taxPublicationRetryAuthorization.test.js`

Then run the normal tax/runtime/full certification gates before publishing.
