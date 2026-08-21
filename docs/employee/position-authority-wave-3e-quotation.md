# Position Authority Wave 3E — Quotation

## Scope

Wave 3E migrates the Quotation workspace from employee-context-only authorization to Position-first authority while preserving the existing branch and employee actor requirements.

Capabilities introduced:

- `quotation.read`
- `quotation.manage`
- `quotation.issue`
- `quotation.lifecycle`

## Route matrix

Read authority:

- `GET /api/sales/quotations`
- `GET /api/sales/quotations/reference-candidates`
- `GET /api/sales/quotations/:quotationId`
- `GET /api/sales/quotations/:quotationId/revisions`
- `GET /api/sales/quotations/:quotationId/lineage`

Read + manage authority:

- `POST /api/sales/quotations`
- `POST /api/sales/quotations/:quotationId/revisions`
- `PUT /api/sales/quotations/:quotationId`
- `POST /api/sales/quotations/:quotationId/items`
- `PUT /api/sales/quotations/:quotationId/items/:lineId`
- `DELETE /api/sales/quotations/:quotationId/items/:lineId`

Read + issue authority:

- `POST /api/sales/quotations/:quotationId/issue`

Read + lifecycle authority:

- `POST /api/sales/quotations/:quotationId/accept`
- `POST /api/sales/quotations/:quotationId/reject`
- `POST /api/sales/quotations/:quotationId/cancel`

## Why quotation is a separate authority family

Quotation is a commercial document workflow, not a stock mutation or tax-document workflow. It can be created with zero line items, edited manually, revised, issued into an immutable document snapshot, and then moved through accepted/rejected/cancelled lifecycle states. Those boundaries are stable business responsibilities and should not be inferred from `sales.core` or document-tax capabilities.

## Compatibility semantics

Historical behavior allowed every authenticated store employee with valid branch and employee context to enter the Quotation workspace. Therefore legacy compatibility preserves all four quotation capabilities for:

- OWNER
- MANAGER
- CASHIER
- TECHNICIAN

The normal migration rule remains binding:

- `positionCapabilities === null` => use legacy role compatibility.
- any array, including `[]` => Position authority is final.
- ADMIN/SUPERADMIN pass centralized capability checks.

Quotation still intentionally requires an employee actor identity because create/update/issue/lifecycle events persist `actorId`. A platform admin without valid branch + employee context is still rejected by `QUOTATION_EMPLOYEE_AUTHORITY_REQUIRED`; Wave 3E does not invent an employee actor for platform users.

## Boundary preservation

Wave 3E does not change:

- quotation business lifecycle rules
- latest-revision guard
- branch isolation
- employee actor validation
- issued snapshot construction
- presentation snapshot construction
- sale/quotation lineage behavior
- database schema

No Prisma migration is required.

## Client

Position configuration receives a dedicated `ใบเสนอราคา` capability group with four independent controls matching the server authority matrix.

## Verification targets

Server:

- `node src/modules/quotation/http/quotationAuthorization.test.js`
- `node tests/employee-position-first-authority.contract.test.js`
- quotation-focused existing contracts if present
- `npm run test`
- `npx prisma validate`

Client:

- `npx vitest run tests/position-quotation-authority-ui.contract.test.js`
- `npx vitest run tests/position-first-authority-ui.contract.test.js`
- `npx vitest run tests/partner-store-employee-onboarding-ui.contract.test.js`
- `npm run typecheck`
- `npm run build`
