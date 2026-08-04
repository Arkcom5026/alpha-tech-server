# Store Device Durable Job API Wave

## Mission
Create branch-authoritative runtime APIs over the Store Device persistence foundation.

## Scope
- Gateway register/read/rotate/revoke contracts
- Session authenticate/heartbeat/disconnect contracts
- Idempotent job create/read/list contracts
- Atomic lease/ack/progress/complete/fail/retry contracts
- Branch-scoped diagnostics
- Repository/service/controller/contract/policy slices

## Invariants
- Authenticated branch authority is derived server-side
- No request may select another branch
- Revoked gateway/session cannot lease or complete work
- Repeated idempotency key returns the same job
- One active lease per job
- Terminal result append-only
- No plaintext credential material

## Dependency
Implementation may prepare contracts now, but persistence-backed execution must target the final exact SHA of PR #285.

## Safety
No migration apply, production WebSocket cutover, physical execution, merge or deploy.
