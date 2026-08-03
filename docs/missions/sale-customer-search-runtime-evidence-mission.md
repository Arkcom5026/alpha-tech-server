# Sale Customer Search E2E Runtime Evidence Mission

## Purpose

Execute the integrated POS Cash Sale flow against the authorized Test Database and produce Browser Authority plus read-only Database Post-condition Authority for the paired Draft PRs.

## Certified Source Candidates

- Server repository: `Arkcom5026/alpha-tech-server`
- Server branch: `fix/sale-customer-search-e2e`
- Server SHA before this mission document: `a72966c7308db2f8f890ff88e0b1965fc00f4dc4`
- Client repository: `Arkcom5026/alpha-tech-client`
- Client branch: `fix/sale-customer-search-e2e`
- Client SHA: `1d5e78ed33e9298cac849abeba23644b0e9b253d`
- Server Draft PR: `#255`
- Client Draft PR: `#68`

The executor must record the actual checked-out SHA of both repositories immediately before execution. A result is invalid if either SHA differs without being reported.

## Branch Rule

This is feature-branch runtime verification. Do not run the current `ALDE Local Certification` workflow as authority because it enforces `RequiredBranch=main`. Do not claim ALDE certification for these Draft PR SHAs.

## Safety Authority

- Use the authorized Test Database only.
- Provisioning requires `.env.restore` and `POS_SALE_E2E_FIXTURE_APPROVAL=ALPHATECH_POS_SALE_E2E_FIXTURE`.
- The fixture may create Test-only records.
- The outcome verifier is read-only and must report `databaseModified: false`.
- No Production database may be read or written.
- No API interception, mock response, or browser request substitution is allowed.

## Execution Sequence

### 1. Checkout

Checkout both repositories to `fix/sale-customer-search-e2e` and verify clean working trees.

Record:

- Client SHA
- Server SHA
- Current branch for each repository
- Working-tree status

### 2. Focused Repository Verification

Server:

```bash
npm ci
npx prisma generate
npx prisma validate
npm test
```

Client:

```bash
npm ci
npm run test:sale-customer-search-e2e
npm run test:core-sales-help
npm run build
```

### 3. Provision Fresh Test Fixture

From Server:

```bash
npm run provision:pos-sale-e2e-fixture
```

Capture the JSON output and export these values for Browser execution:

- `E2E_TEST_USERNAME`
- `E2E_TEST_PASSWORD`
- `POS_SALE_E2E_BRANCH_SLUG`
- `POS_SALE_E2E_STOCK_BARCODE`
- `POS_SALE_E2E_EXPECTED_RETAIL_TOTAL`
- `POS_SALE_E2E_CUSTOMER_NAME`
- `POS_SALE_E2E_CUSTOMER_PHONE`

Also record fixture `branchId`, `employeeId`, `stockItemId`, and `productId`.

### 4. Start Runtime Against Test DB

Start Server against the same authorized Test Database used by the fixture. Start Client against that Server. Record effective URLs and startup logs.

### 5. Browser Authority

From Client:

```bash
npm run test:e2e:pos-sale
```

The browser must perform the real flow:

1. Log in as the Test employee.
2. Open the employee store POS Sale page.
3. Search for the fixture customer phone using the unified Customer Search field.
4. Confirm the customer is not yet found in the store.
5. Create the customer through the UI and real Customer Create API.
6. Retain server-issued first-association evidence.
7. Scan the fresh fixture StockItem barcode.
8. Add the item to the cart.
9. Receive full cash payment.
10. Complete the sale through the real Sale Completion API.
11. Confirm the completion response contains a Sale ID and the created Customer ID.
12. Open the receipt route.

Required Browser evidence:

- Playwright result
- Screenshot/video/trace when available
- Sale ID
- Customer ID
- Stock barcode
- Authenticated Branch slug/ID
- Completion response status and error code if failed

### 6. Test-DB Post-condition Authority

From Server, using the exact fixture StockItem barcode:

```bash
npm run verify:pos-sale-e2e-outcome -- <POS_SALE_E2E_STOCK_BARCODE>
```

The read-only verifier must confirm:

- StockItem status is `SOLD`.
- Sale is `COMPLETED` and `PAID`.
- `Sale.branchId`, `SaleItem`, `StockItem`, and `StockMovement.branchId` are identical.
- `Sale.customerId` is non-null and equals the Browser-created Customer ID.
- Customer phone equals the fixture phone.
- The newly created Sale is permanent branch evidence for that Customer.
- One matching `SALE` StockMovement exists with `qty = -1` and `refId = Sale.id`.

## Acceptance

PASS requires all of the following:

- Client and Server SHAs recorded and match the checked-out feature branches.
- Focused repository verification passes.
- Browser flow passes without interception or mocks.
- Test-DB verifier passes against the same fixture barcode and Sale.
- Browser Customer ID equals Database `Sale.customerId`.
- All tenant IDs match the authenticated store.

Browser PASS without Test-DB post-condition is not E2E PASS. Test-DB PASS without Browser evidence is not E2E PASS.

## Failure Reporting

On failure, report:

- exact failed phase
- Client/Server SHA
- command and exit code
- HTTP status/error code when applicable
- Browser screenshot/trace location
- fixture barcode and customer phone
- verifier output
- whether any Test-only data was retained

Do not merge either Draft PR until the complete evidence chain is attached to both PRs and explicit merge approval is given.
