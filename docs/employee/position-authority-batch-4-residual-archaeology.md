# Position Authority Batch 4 — Residual Archaeology

Base: `8dbd9e33f3c68f8cb965119e0e493ffaf1a314a2`

Branch: `feature/employee-position-authority-batch-4-residual-experience-trace`

## Purpose

Batch several remaining Position-first authorization residuals before the next Local merge/verification cycle. This batch intentionally avoids the small-wave pattern and keeps GitHub as the execution workspace until a larger checkpoint is ready.

## Confirmed residual boundaries

### 1. Communication

Current `communicationAccessPolicy.js` derives authority from `actor.employeeRole || actor.v2Role || actor.position` and therefore still treats legacy role strings as feature authority.

Current behavior to preserve during migration:
- authenticated active employee context may use operational communication functions;
- legacy OWNER / MANAGER may manage communication profiles;
- legacy CASHIER / TECHNICIAN may not manage communication profiles;
- platform ADMIN / SUPERADMIN retain elevated authority.

Target capabilities:
- `communication.access`
- `communication.profile.manage`

Operational customer channels, repair preferences and repair activities stay under `communication.access`; profile mutation additionally requires `communication.profile.manage`.

### 2. Store Experience

Current draft and media routes contain local hard-coded employee/platform role checks. Historical behavior is broad employee access after authentication.

Target capabilities:
- `store-experience.read`
- `store-experience.manage`
- `store-experience.publish`

Compatibility rule: OWNER / MANAGER / CASHIER / TECHNICIAN keep historical access while their Position capability array remains null. Any non-null Position capability array is authoritative, including `[]`.

Draft read uses READ; draft save and media upload use READ + MANAGE; publish/unpublish use READ + MANAGE + PUBLISH.

### 3. Product Trace

Current product trace financial visibility still reads `employeeProfile.v2Role` directly. Trace access and financial visibility must be Position-capability driven without changing branch-scoped trace lookup or response semantics.

Target capabilities:
- `product.trace.read`
- `product.trace.financials`

Compatibility rule: all legacy employee roles keep trace read; legacy OWNER / MANAGER keep financial/supplier visibility; platform ADMIN / SUPERADMIN retain all capabilities.

## Migration invariants

- `positionCapabilities = null` or missing => legacy `v2Role` compatibility fallback.
- `positionCapabilities = []` => migrated Position is authoritative and grants nothing.
- Platform ADMIN / SUPERADMIN remain capability-superusers through the central resolver.
- Route/policy layers own feature authority. Domain, branch isolation and persistence rules remain where they are today.
- No Prisma migration is expected for this batch.

## Verification checkpoint

Do not request Local merge after each boundary. Complete all three residual families, add focused regression contracts, update the Position UI capability catalog, then run one Local verification cycle for the entire batch.
