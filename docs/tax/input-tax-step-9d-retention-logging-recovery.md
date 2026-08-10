# Input Tax Step 9D — Retention, Logging, Recovery

## Scope

Step 9D closes the repository-level policy boundary for retention/immutability, PII-aware logging, and retry/failure semantics without changing accounting semantics, backfilling data, or introducing retention deletion jobs.

## Retention / Immutability

The following authorities are retained as non-destructive evidence:

- `InputVatRecord`: authority-immutable. The approved-document service creates or replays the authority record; it does not expose update/delete mutation.
- `TaxDocumentLifecycleEvent`: append-only audit evidence. Repository authority inserts lifecycle events and exposes no update/delete operation.
- duplicate/replacement decision history: append-only audit evidence.
- filing evidence: historical evidence must not be deleted as part of ordinary workflow.
- investigation resolution evidence and audit-package metadata/checksum: append-only once concrete runtime surfaces exist.

Step 9D does **not** create a deletion scheduler or retention purge. A legal/business retention duration is a separate owner policy decision.

## PII-aware Logging

Input Tax runtime logs may include:

- request/trace ID
- HTTP method/path
- branch ID
- actor employee ID
- machine-readable error code
- error class/name

They must not include:

- access/refresh token
- request body or full document snapshot
- database URL/credentials
- full supplier/customer tax ID unless explicitly justified by a separate secure-audit requirement
- personal phone/email unless explicitly required

The Input VAT Report controller now logs only a bounded safe context on server errors and does not return the internal exception message/details for 5xx responses.

The global auth middleware currently logs only a one-way truncated token fingerprint rather than the bearer token itself; changing global authentication observability is outside this Input Tax increment unless a broader security review requires it.

## Retry / Failure Semantics

Machine-readable policy is exported from `src/modules/tax/policies/inputTaxOperationalAssurancePolicy.js`.

- reads/report reads: retry-safe
- duplicate decision: replay-safe
- replacement link: replay-safe
- filing select: replay-safe
- filing remove: version-sensitive; on conflict refresh state before retry
- filing submit: replay-safe and transaction-protected
- tax period transition: compare-and-set; on conflict refresh before retry
- unknown high-impact mutation: do not blind retry

`InputVatRecord` creation has its own replay authority using tax-document uniqueness/replay key and handles unique-conflict recovery.

## Deferred Surfaces

No concrete Input Tax investigation/audit-package HTTP runtime was found in the continuation baseline during this increment. Step 9D therefore defines their retention class but does not invent new endpoints, tables, deletion jobs, or migration work solely to satisfy the checklist.

When those concrete surfaces exist, they must inherit append-only evidence and deterministic/checksum-aware replay semantics.

## Runtime Gate

Repository contracts are evidence only. Runtime certification must later execute:

- Step 9A–9D targeted contracts
- existing Input VAT authority tests
- lifecycle tests
- filing concurrency/replay tests with a real DB
- error-boundary verification
- Prisma validate/generate and relevant server certification

No Production data mutation is required for Step 9D repository certification.
