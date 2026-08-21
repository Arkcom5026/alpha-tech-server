# Position-first Authority — Wave 2B Inventory

## Scope

This wave migrates only the privileged Simple Stock mutation boundary to Position capabilities.

In scope:
- Simple Stock adjustment authorization
- Simple Stock inter-branch transfer authorization
- Position capability registry and Position UI controls
- Legacy OWNER/MANAGER compatibility while Position.capabilities is NULL

Out of scope:
- Procurement receiving
- Quick Stock / Quick Receipt business flows
- Structured inventory mutation authority
- Product pricing
- Repair, Tax, Finance, Communication, Store Experience
- Removing v2Role

## Capabilities

- `inventory.adjust` — create Simple Stock adjustments
- `inventory.transfer` — create Simple Stock inter-branch transfers

## Migration semantics

- `Position.capabilities = null`: legacy compatibility mode. OWNER/MANAGER retain the two privileged Simple Stock capabilities.
- `Position.capabilities = []` or an explicit array: Position mode. Only capabilities present in the Position array apply.
- Platform `ADMIN` / `SUPERADMIN`: retains system authority through the centralized Position authority resolver.
- CASHIER and TECHNICIAN legacy compatibility do not gain these privileged stock mutations.

## Runtime boundary

The Simple Stock adjustment and transfer controllers must call the centralized `employeePositionAuthority` resolver through `hasCapability` and must not test OWNER/MANAGER directly.

## Parallel-task isolation

This wave intentionally avoids Procurement, Quick Stock, Structured Inventory, pricing, and other domains so concurrent tasks can continue without broad file overlap.

## Verification checkpoint

Server focused gates:
- `node tests/employee-position-first-authority.contract.test.js`
- `node tests/simple-adjustment-authority.test.js`
- `node tests/simple-transfer-authority.test.js`
- `node scripts/verify-employee-lifecycle-runtime.js`
- `npm run test`
- `npx prisma validate`

Client focused gates:
- `npx vitest run tests/position-first-authority-ui.contract.test.js`
- `npx vitest run tests/partner-store-employee-onboarding-ui.contract.test.js`
- `npm run typecheck`
- `npm run build`
