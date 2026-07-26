# Tax Period Frontend API Contract Handoff v1

Status: READY FOR FRONTEND IMPLEMENTATION

Backend authority branch: `feature/tax-authority-prisma-foundation-step-3.7x`

Administrative response version: `1`

## 1. Purpose

This document is the frontend handoff for Tax Period administration. Frontend code must consume the response projections and `availableActions` returned by the backend rather than recreating Tax Period lifecycle rules locally.

## 2. Authentication and authority

All endpoints require an authenticated token.

Allowed administrative authority:

- Account roles: `SUPERADMIN`, `ADMIN`
- Employee roles: `OWNER`, `MANAGER`

Branch behavior:

- `SUPERADMIN` and `ADMIN` may explicitly request a branch.
- `OWNER` and `MANAGER` are restricted to `req.user.branchId`.
- A cross-branch request is rejected before repository access.

## 3. Canonical Tax Period response

Every Tax Period item returned by list, detail, summary, or lifecycle transition uses this shape:

```json
{
  "responseVersion": "1",
  "id": "tax-period-id",
  "branchId": 1,
  "periodCode": "2026-07",
  "startDate": "2026-07-01T00:00:00.000Z",
  "endDate": "2026-07-31T23:59:59.999Z",
  "status": "OPEN",
  "closedAt": null,
  "lockedAt": null,
  "submittedAt": null,
  "reopenedAt": null,
  "createdAt": "2026-07-01T00:00:00.000Z",
  "updatedAt": "2026-07-01T00:00:00.000Z",
  "availableActions": [
    {
      "action": "CLOSE",
      "targetStatus": "CLOSED"
    }
  ]
}
```

Frontend must treat `responseVersion` as the response contract version, not a database record version.

## 4. Lifecycle statuses and actions

Possible statuses:

- `OPEN`
- `CLOSED`
- `LOCKED`
- `SUBMITTED`
- `REOPENED`

Backend-projected actions:

| Current status | Available actions |
| --- | --- |
| `OPEN` | `CLOSE` |
| `CLOSED` | `LOCK`, `REOPEN` |
| `REOPENED` | `CLOSE` |
| `LOCKED` | `SUBMIT` |
| `SUBMITTED` | none |

Frontend rule:

- Render lifecycle buttons only from `availableActions`.
- Do not infer actions from `status`.
- After any lifecycle mutation, replace local period state with `data.taxPeriod` from the response.

## 5. Endpoints

Base path: `/api/tax`

### 5.1 List Tax Periods

```http
GET /api/tax/periods?branchId=1&fromDate=<optional>&toDate=<optional>&status=<optional>
```

`status` may be one value or a comma-separated list.

Success: `200`

```json
{
  "ok": true,
  "data": {
    "branchId": 1,
    "count": 2,
    "periods": [
      {
        "responseVersion": "1",
        "id": "tax-period-id",
        "branchId": 1,
        "periodCode": "2026-07",
        "startDate": "2026-07-01T00:00:00.000Z",
        "endDate": "2026-07-31T23:59:59.999Z",
        "status": "OPEN",
        "closedAt": null,
        "lockedAt": null,
        "submittedAt": null,
        "reopenedAt": null,
        "createdAt": "2026-07-01T00:00:00.000Z",
        "updatedAt": "2026-07-01T00:00:00.000Z",
        "availableActions": [
          { "action": "CLOSE", "targetStatus": "CLOSED" }
        ]
      }
    ]
  }
}
```

### 5.2 Tax Period Summary

```http
GET /api/tax/periods/summary?branchId=1&referenceDate=<optional ISO date>
```

If `referenceDate` is omitted, the backend uses the current time.

Success: `200`

```json
{
  "ok": true,
  "data": {
    "branchId": 1,
    "referenceDate": "2026-07-27T00:00:00.000Z",
    "total": 5,
    "countsByStatus": {
      "OPEN": 1,
      "CLOSED": 1,
      "LOCKED": 1,
      "SUBMITTED": 1,
      "REOPENED": 1
    },
    "currentPeriod": null
  }
}
```

`currentPeriod` is either `null` or the canonical Tax Period response.

### 5.3 Tax Period Detail

```http
GET /api/tax/periods/:taxPeriodId?branchId=1
```

Success: `200`

```json
{
  "ok": true,
  "data": {
    "branchId": 1,
    "taxPeriod": {
      "responseVersion": "1",
      "id": "tax-period-id",
      "branchId": 1,
      "periodCode": "2026-07",
      "startDate": "2026-07-01T00:00:00.000Z",
      "endDate": "2026-07-31T23:59:59.999Z",
      "status": "OPEN",
      "closedAt": null,
      "lockedAt": null,
      "submittedAt": null,
      "reopenedAt": null,
      "createdAt": "2026-07-01T00:00:00.000Z",
      "updatedAt": "2026-07-01T00:00:00.000Z",
      "availableActions": [
        { "action": "CLOSE", "targetStatus": "CLOSED" }
      ]
    }
  }
}
```

### 5.4 Ensure Monthly Period

```http
POST /api/tax/periods/ensure
Content-Type: application/json
```

```json
{
  "branchId": 1,
  "referenceDate": "2026-07-27T00:00:00.000Z"
}
```

Success:

- `201` when a period is created.
- `200` when the request reuses an existing period.

Frontend should use the returned `created` indicator rather than inferring creation from status code alone.

### 5.5 Ensure Operational Readiness

```http
POST /api/tax/periods/readiness
Content-Type: application/json
```

```json
{
  "branchIds": [1],
  "referenceDate": "2026-07-27T00:00:00.000Z",
  "monthsAhead": 3
}
```

Success: `200`

This endpoint is intended for administrative readiness setup and not for routine page loading.

### 5.6 Close Period

```http
POST /api/tax/periods/:taxPeriodId/close
Content-Type: application/json
```

```json
{
  "branchId": 1,
  "occurredAt": "2026-07-27T10:00:00.000Z"
}
```

### 5.7 Lock Period

```http
POST /api/tax/periods/:taxPeriodId/lock
Content-Type: application/json
```

Request body is identical to Close Period.

### 5.8 Submit Period

```http
POST /api/tax/periods/:taxPeriodId/submit
Content-Type: application/json
```

Request body is identical to Close Period.

### 5.9 Reopen Period

```http
POST /api/tax/periods/:taxPeriodId/reopen
Content-Type: application/json
```

Request body is identical to Close Period.

Lifecycle mutation success: `200`

```json
{
  "ok": true,
  "data": {
    "transitioned": true,
    "replayed": false,
    "previousStatus": "OPEN",
    "taxPeriod": {
      "responseVersion": "1",
      "id": "tax-period-id",
      "branchId": 1,
      "periodCode": "2026-07",
      "startDate": "2026-07-01T00:00:00.000Z",
      "endDate": "2026-07-31T23:59:59.999Z",
      "status": "CLOSED",
      "closedAt": "2026-07-27T10:00:00.000Z",
      "lockedAt": null,
      "submittedAt": null,
      "reopenedAt": null,
      "createdAt": "2026-07-01T00:00:00.000Z",
      "updatedAt": "2026-07-27T10:00:00.000Z",
      "availableActions": [
        { "action": "LOCK", "targetStatus": "LOCKED" },
        { "action": "REOPEN", "targetStatus": "REOPENED" }
      ]
    }
  }
}
```

Idempotent replay also returns `200`:

```json
{
  "ok": true,
  "data": {
    "transitioned": false,
    "replayed": true,
    "previousStatus": "CLOSED",
    "taxPeriod": {}
  }
}
```

The real replay response contains the complete canonical Tax Period object.

## 6. Error handling

Expected HTTP mapping:

| HTTP | Meaning | Representative codes |
| --- | --- | --- |
| `400` | Invalid request data | `INVALID_TAX_PERIOD_ID`, `INVALID_TAX_PERIOD_ADMINISTRATIVE_BRANCH`, `INVALID_TAX_PERIOD_ADMINISTRATIVE_STATUS`, `INVALID_TAX_PERIOD_ADMINISTRATIVE_DATE_RANGE`, `INVALID_TAX_PERIOD_ADMINISTRATIVE_REFERENCE_DATE`, `INVALID_TAX_PERIOD_LIFECYCLE_DATE` |
| `403` | Insufficient authority or forbidden branch | `TAX_PERIOD_ADMINISTRATIVE_ACCESS_FORBIDDEN`, `TAX_PERIOD_ADMINISTRATIVE_BRANCH_FORBIDDEN` |
| `404` | Period does not exist in the requested branch | `TAX_PERIOD_NOT_FOUND` |
| `409` | Lifecycle or creation conflict | `TAX_PERIOD_TRANSITION_FORBIDDEN`, `TAX_PERIOD_LIFECYCLE_CONFLICT`, `TAX_PERIOD_BOUNDARY_OVERLAP`, `TAX_PERIOD_CODE_CONFLICT`, `TAX_PERIOD_CREATION_CONFLICT`, `TAX_PERIOD_NOT_AVAILABLE` |

Frontend behavior:

- `400`: show request-specific validation feedback.
- `403`: block the action and show an authority/branch message.
- `404`: remove stale detail state and return to the list or reload.
- `409`: keep the page open, display the conflict, then refresh Detail or Summary because another transition may have changed the current state.

## 7. Recommended frontend ownership

The Tax module should own its own UI and API client:

```text
src/modules/tax/
  api/
    taxPeriodApi.*
  query/
    list/
    detail/
    summary/
  lifecycle/
    close/
    lock/
    submit/
    reopen/
  components/
    TaxPeriodStatus.*
    TaxPeriodActions.*
```

Do not move Tax workflow components into a generic shared/common module. Only neutral primitives such as Button, Dialog, Badge, and DateField should be shared.

## 8. UI action mapping

Recommended Thai labels:

| Backend action | Thai label | Confirmation |
| --- | --- | --- |
| `CLOSE` | ปิดรอบภาษี | Required |
| `LOCK` | ล็อกรอบภาษี | Required |
| `SUBMIT` | ยื่นรอบภาษี | Required |
| `REOPEN` | เปิดรอบภาษีอีกครั้ง | Required |

The action target endpoint must be selected from `action`, while `targetStatus` is display/audit context. Frontend must not send `targetStatus` to the lifecycle endpoint.

## 9. Refresh policy

After lifecycle mutation:

1. Replace the current detail object with `data.taxPeriod` immediately.
2. Refresh Summary because counts may have changed.
3. Refresh List only when the list is visible or cached.
4. Do not optimistically construct lifecycle timestamps or available actions.

## 10. Frontend implementation gate

Frontend implementation may begin when the branch containing this handoff is available locally.

Repository gate: documented and ready.

Runtime gate still pending:

- authenticated requests against a running server
- Prisma client/database execution
- lifecycle transition tests with real Tax Period records
- browser integration and UX validation
