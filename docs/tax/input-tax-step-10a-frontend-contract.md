# Input Tax 10/10 — Step 10A Frontend Contract Handoff

## Purpose

This document freezes the backend-to-frontend contract inventory for the concrete Input Tax surfaces verified on `feature/input-tax-step-9-10-assurance`.

The machine-readable authority is:

`src/modules/tax/contracts/inputTaxFrontendContract.js`

Frontend code must not recreate tax decisions, reconciliation decisions, filing eligibility, branch authorization, replay rules, or lifecycle rules.

## Canonical API mounts

- Input Tax / Tax Intake: `/api/tax-intake`
- Tax Period: `/api/tax-periods`
- Input VAT Report: `/api/input-tax-reports`
- `/api/tax` remains a compatibility alias for Tax Intake and Tax Period routes and must not be removed without historical dependency evidence.

## Authority model

All listed runtime surfaces are authenticated through `verifyToken` or a parent router protected by it.

The current repository role model supports:

- Account: `SUPERADMIN`, `ADMIN`, `EMPLOYEE`, `CUSTOMER`
- Employee: `OWNER`, `MANAGER`, `CASHIER`

High-impact Input Tax actions currently use `SUPERADMIN`, `ADMIN`, `OWNER`, and `MANAGER`. The frontend may hide or disable actions, but backend rejection remains authoritative.

## Concrete frontend surfaces

### Overview and document reads

- `GET /api/tax-intake/input-documents/overview`
  - explicit period range max: 366 days
  - read retry-safe
  - backend owns reconciliation, duplicate, replacement and eligibility projections
- `GET /api/tax-intake/input-documents/pending`
- `GET /api/tax-intake/documents`
  - default limit 50; max 200; offset supported
- `GET /api/tax-intake/documents/:taxDocumentId`
  - includes ordered lifecycle evidence

### Lifecycle

- `POST /api/tax-intake/documents/:taxDocumentId/transition`
  - body: `branchId`, `targetStatus`, optional/required-by-action `reason`
  - replay-safe when target state is already reached
  - approval of an eligible Input Tax Invoice may create/replay the authoritative `InputVatRecord` inside the same transaction

### Receipt linking / reconciliation evidence

- `GET /api/tax-intake/documents/:taxDocumentId/receipt-links`
- `POST /api/tax-intake/documents/:taxDocumentId/receipt-links`
  - accepts `commandKey`; use it for replay-safe attach semantics
- `PATCH /api/tax-intake/documents/:taxDocumentId/receipt-links/:linkId`
- `POST /api/tax-intake/documents/:taxDocumentId/receipt-links/:linkId/cancel`

Frontend must refresh server projections after mutations. It must not recompute reconciliation authority locally.

### Duplicate / replacement decisions

- `POST /api/tax-intake/documents/:taxDocumentId/duplicate-decision`
- `POST /api/tax-intake/documents/:taxDocumentId/replacement-link`

Both require authenticated privileged authority and employee actor identity. Decision reasons are backend-validated. Replayed identical decisions must not create duplicate lifecycle evidence.

### Filing

- `POST /api/tax-intake/input-documents/filing/batches/:batchId/documents/:taxDocumentId/select`
  - returns filing item version and replay status
- `POST /api/tax-intake/input-documents/filing/batches/:batchId/documents/:taxDocumentId/remove`
  - body includes mandatory reason and `version` or `expectedVersion`
  - stale write error: `INPUT_TAX_STALE_VERSION`
- `POST /api/tax-intake/input-documents/filing/batches/:batchId/file`
  - atomic submit of filing batch/items
  - retry after an uncertain response is replay-safe

### Tax Period

- `GET /api/tax-periods/periods`
- `GET /api/tax-periods/periods/summary`
- `GET /api/tax-periods/periods/:taxPeriodId`
- `POST /api/tax-periods/periods/:taxPeriodId/close`
- `POST /api/tax-periods/periods/:taxPeriodId/lock`
- `POST /api/tax-periods/periods/:taxPeriodId/submit`
- `POST /api/tax-periods/periods/:taxPeriodId/reopen`

Transitions use deterministic compare-and-set behavior. A concurrent incompatible state change returns `TAX_PERIOD_STALE_VERSION` rather than silently overwriting the current state.

### Accounting-office package

- `GET /api/tax-periods/accounting-office/packages/:taxPeriodId`

This is the concrete package surface verified in the current continuation branch. It is read retry-safe. Step 10 must not invent a second audit-package authority.

### Input VAT Report

- `GET /api/input-tax-reports`
- query: either `startDate` + `endDate`, or `month` + `year`
- max date range: 366 days
- max result rows: 2,000
- overflow is refused rather than silently truncated
- primary authority: `InputVatRecord`
- historical `PurchaseOrderReceipt` rows remain compatibility fallback only

## Machine-readable error codes for frontend mapping

The machine-readable contract publishes the current high-value codes, including:

- `INPUT_TAX_FILING_RECONCILIATION_REQUIRED`
- `INPUT_TAX_FILING_ELIGIBILITY_REQUIRED`
- `INPUT_TAX_DOCUMENT_ALREADY_IN_FILING`
- `INPUT_TAX_STALE_VERSION`
- `INPUT_TAX_FILING_STALE`
- `INPUT_TAX_REASON_REQUIRED`
- `INPUT_TAX_DECISION_REASON_REQUIRED`
- `INPUT_TAX_REPLACEMENT_SELF_REFERENCE`
- `INPUT_TAX_REPLACEMENT_ALREADY_LINKED`
- `INPUT_TAX_REPLACEMENT_CYCLE`
- `INPUT_TAX_OVERVIEW_RANGE_TOO_LARGE`
- `INPUT_TAX_REPORT_RANGE_TOO_LARGE`
- `INPUT_TAX_REPORT_RESULT_TOO_LARGE`
- `TAX_DOCUMENT_LIFECYCLE_CONFLICT`
- `TAX_PERIOD_STALE_VERSION`

Step 10B owns the Thai-message mapping and disabled-action UX. Frontend must map `code`, not parse English server messages.

## Surfaces not verified as concrete HTTP contracts

The continuation branch does not currently expose a verified dedicated HTTP endpoint for:

- investigation workspace
- supplier tax health
- dedicated executive overview separate from the existing Input Tax Overview
- dedicated filing simulation

These are explicitly marked unavailable in the machine-readable contract. They are not silently treated as complete and no placeholder route was created.

## Backward compatibility

`/api/tax` is mounted as a compatibility alias for both Tax Intake and Tax Period. Canonical new frontend calls should use `/api/tax-intake` and `/api/tax-periods`, while aliases remain until dependency evidence supports removal.

Input VAT reporting must continue to read `InputVatRecord` first and use legacy receipt data only for historical compatibility.

## Step 10A repository evidence

`tests/input-tax-step-10a-frontend-contract.contract.test.js` verifies the canonical server mounts, core route presence, version/replay/bounds contract, compatibility aliases and explicit unavailable surfaces.

Runtime execution remains a later gate; repository contract evidence alone is not Operational or Production certification.
