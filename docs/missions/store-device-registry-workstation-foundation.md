# Store Device Registry & Workstation Foundation

## Mission
Establish the branch-owned device registry and workstation-assignment contract needed by the Store Device management UI.

## Scope
- Printer and future device identity
- Gateway ownership
- Explicit normalized capabilities
- Branch-scoped list and detail projection
- Rename and workstation assignment
- Device revocation lifecycle
- Cross-store isolation and gateway reassignment denial

## Invariants
- Device identity is unique only within a branch.
- A device cannot silently move to another gateway or branch.
- Revoked devices cannot be renamed or assigned.
- Workstation assignment is cleared on revocation.
- Credentials, proof keys, tokens and certificates are not part of the device contract.

## Current boundary
This increment defines and verifies the server domain authority only. It does not add Prisma models, migration, routes or Production runtime wiring. Persistence and API adoption require a separate exact-source increment after this contract is accepted.

## Verification
```powershell
node tests/store-device-registry-workstation-foundation.contract.test.js
```
