# Employee Position Authority — Wave 3L Communication

## Scope

Wave 3L migrates the communication module away from direct `employeeRole` / `v2Role` interpretation and onto the centralized Position-first capability resolver.

Affected runtime surface:

- `GET /api/communication/profiles`
- `POST /api/communication/profiles`
- `GET /api/communication/customers/:customerId/channels`
- `POST /api/communication/customers/:customerId/channels`
- `GET /api/communication/repairs/:repairJobId/preference`
- `PUT /api/communication/repairs/:repairJobId/preference`
- `GET /api/communication/repairs/:repairJobId/activities`
- `POST /api/communication/repairs/:repairJobId/activities`

The existing authenticated employee-context guard remains authoritative for branch and employee identity.

## Capabilities

- `communication.use`
  - covers day-to-day communication operations: profile viewing, customer communication channels, repair communication preferences, and repair communication activity records.
- `communication.profile.manage`
  - covers creation or update of branch communication profiles.

## Compatibility

Legacy fallback is intentionally preserved while positions migrate:

- OWNER: `communication.use` + `communication.profile.manage`
- MANAGER: `communication.use` + `communication.profile.manage`
- CASHIER: `communication.use`
- TECHNICIAN: `communication.use`
- ADMIN / SUPERADMIN: centralized platform-role authority still resolves all capabilities, but communication routes continue to require a valid employee context.

For migrated positions, a non-null `positionCapabilities` array is authoritative. An explicit empty array grants no communication capability. A null or missing array falls back to legacy `v2Role` compatibility.

## Authority ownership

`communicationAccessPolicy.js` now delegates capability resolution to `employeePositionAuthority.js`. It no longer interprets employee roles directly. Route-level operation semantics remain unchanged: ordinary communication operations use `viewCommunication`, while branch communication profile mutation uses `manageCommunicationProfiles`.

No Prisma schema or migration change is required for this wave.
