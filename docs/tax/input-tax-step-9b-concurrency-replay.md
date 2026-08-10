# Input Tax 10/10 — Step 9B Concurrency and Replay Protection

## Scope

This increment hardens existing Input Tax mutations against concurrent requests, double-clicks and network retries. It does not add a second tax authority, change VAT semantics, alter Stock/Inventory/Payment, or add Prisma migrations.

## Filing selection

- Every select runs inside a database transaction.
- The filing batch row is locked before mutation authority is evaluated.
- The TaxDocument row is locked before checking active filing items.
- This serializes two concurrent attempts to select the same TaxDocument into different batches.
- A repeated select into the same active batch returns the existing filing item with `replayed: true` and does not increment its version.
- A committed active item in another non-voided batch returns `INPUT_TAX_DOCUMENT_ALREADY_IN_FILING`.

## Filing removal

- Removal locks the batch and target filing item.
- A non-blank reason is mandatory at backend authority (`INPUT_TAX_REASON_REQUIRED`).
- Clients may submit `version` or `expectedVersion` from the filing item projection.
- A stale supplied version is rejected deterministically with `INPUT_TAX_STALE_VERSION`.
- Retrying an already completed removal returns the current REMOVED item with `replayed: true` rather than mutating it again.

## Filing submission

- Filing item transition to FILED and filing batch transition from DRAFT to SUBMITTED occur in one transaction.
- Batch row locking serializes remove-versus-submit and duplicate submit requests for the same batch.
- A retry after a successful submit returns `status: SUBMITTED` and `replayed: true`; items are not filed twice and versions are not incremented again.
- Branch ownership is checked against the locked batch authority inside the same submit transaction.

## Duplicate decision

- TaxDocument row locking remains the serialization boundary.
- Replaying the same duplicate decision with the same normalized reason returns the stored authority projection with `replayed: true`.
- The replay path does not append another lifecycle event.
- A different decision or a materially different reason remains a new auditable decision command.

## Replacement decision

- Replacement pair locks are acquired in ascending TaxDocument id order instead of `Promise.all` to avoid opposite-order deadlocks.
- Replaying the same replacement target with the same normalized reason returns the stored authority projection with `replayed: true` and does not append a duplicate lifecycle event.
- Existing replacement conflict and cycle detection remain authoritative.

## Tax period transition

TaxPeriod is shared tax infrastructure, so the change is deliberately generic and preserves existing Output Tax preconditions.

- The repository transition is compare-and-set: the UPDATE requires the status observed by the service (`expectedStatus`).
- If another browser changes the period first, the losing request reloads the current authority.
- If the current authority already equals the requested target, the request is a replay and succeeds with `replayed: true`.
- If it moved to another state, the request is rejected with `TAX_PERIOD_STALE_VERSION` instead of overwriting the newer state.

## Retry semantics

- Reads remain retry-safe.
- Filing select/remove/submit and duplicate/replacement decisions are replay-aware.
- Tax period transitions are replay-aware and compare-and-set protected.
- Blind retry of a different command remains forbidden; callers must inspect conflict/error codes and refresh current authority.

## Runtime certification

Repository contract evidence is provided by `tests/input-tax-step-9b-concurrency-replay.contract.test.js`.

Runtime execution, database race tests, Browser E2E and production post-condition evidence remain later certification gates and must not be inferred from repository evidence alone.
