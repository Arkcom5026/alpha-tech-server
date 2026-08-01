# Sale Settlement Error Authority

## Mission

Preserve deterministic Sale Settlement errors end to end so callers receive the original status, code, and detail instead of a generic 500 response.

## Scope

- preserve `PAYMENT_EVIDENCE_INSUFFICIENT` as a deterministic 409
- preserve branch-scoped not-found and invalid-input responses
- avoid converting known settlement errors into generic 500 responses
- add focused settlement contracts
- no cancellation/void redesign
- no payment posting rewrite
- no route compatibility removal

## Safety Boundaries

- branch isolation remains mandatory
- payment evidence remains the authority for closing a sale
- no stock mutation unless settlement is fully validated
- repository/CI evidence does not represent Human Operational Test

## Verification Target

- focused contract
- backend regression tests
- startup smoke
- integrated ALDE SyncAndCertify after merge
