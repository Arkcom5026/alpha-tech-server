# Position-first Employee Authority — Wave 2A Repair

Date: 2026-08-21

## Scope

This wave migrates the Repair domain from direct `v2Role`-owned authorization to Position-owned capabilities while preserving `v2Role` as a compatibility fallback for positions that have not migrated yet.

This branch intentionally does **not** migrate Tax, Procurement, Product/Pricing, Communication, Inventory, Store Experience, or other domains. Those remain separate future waves so concurrent engineering agendas can continue without cross-task edits.

## Authority rule

- `Position.capabilities === null` → legacy compatibility mode. `v2Role` is translated to the historical Repair capability set.
- `Position.capabilities` is an array, including `[]` → Position mode. The array is authoritative and legacy role labels cannot add permissions.
- `ADMIN` / `SUPERADMIN` remain platform authority and resolve all registered Position capabilities.
- Repair middleware reloads the employee's active Position capability state from the database before publishing Repair runtime authority.

## Repair capabilities

- `repair.read`
- `repair.intake`
- `repair.workflow`
- `repair.parts`
- `repair.estimate`
- `repair.claim`
- `repair.handover`
- `repair.customer-access`
- `repair.customer-override`

`repair.customer-override` replaces the previous direct `actor.role === 'MANAGER'` authorization used when explicitly accepting a repair for a customer who does not match the current device owner. The explicit request flag remains required; the capability alone does not trigger an override.

## Compatibility mapping

During migration only:

- `OWNER` / `MANAGER` → all Repair capabilities plus `employee.manage`.
- `CASHIER` → Repair read, intake, estimate, claim, and customer-access.
- legacy `TECHNICIAN` callers → Repair read, workflow, and parts.

These mappings are compatibility behavior, not the target model. Once a Position has an explicit capability array, that Position configuration wins completely.

## Client behavior

The Position editor exposes the Repair capabilities as individual permission choices. No capability is inferred from the Thai or English Position name. A store can therefore define its own Position names while assigning exactly the operational access required.

## Residual migration boundary

A repository inventory shows additional `employeeRole` / `v2Role` authorization in domains such as Tax, Procurement, Product/Pricing, Communication, Inventory, Store Experience, and other legacy boundaries. They are deliberately not changed in Wave 2A. Each should be migrated in a dedicated capability wave after local verification of this Repair cutover.

## Verification target

Focused verification for this wave should include:

- `tests/employee-position-first-authority.contract.test.js`
- `tests/repair-capability-authorization.integration.contract.test.js`
- `tests/repair-position-customer-override-authority.contract.test.js`
- `src/modules/repair/utils/repairActor.test.js`
- `src/modules/repair/create/createRepairJobSlice.test.js`
- `scripts/verify-repair-capability-runtime.js`
- `scripts/verify-employee-lifecycle-runtime.js`
- repository certification after focused checks pass
