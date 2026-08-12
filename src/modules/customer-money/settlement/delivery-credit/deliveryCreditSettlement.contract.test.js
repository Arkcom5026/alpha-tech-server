'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  normalizeIdempotencyKey,
  parseCreateSettlementInput,
} = require('./deliveryCreditSettlementContract');
const {
  buildSettlementRequestHash,
} = require('./createDeliveryCreditSettlementService');

const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');
const contract = read('deliveryCreditSettlementContract.js');
const queryService = read('listEligibleDeliveryCreditsService.js');
const createService = read('createDeliveryCreditSettlementService.js');
const cancelService = read('cancelDeliveryCreditSettlementService.js');
const detailQueryService = read('queryDeliveryCreditSettlementService.js');
const route = read('deliveryCreditSettlementRoute.js');
const controller = read('deliveryCreditSettlementController.js');
const sourcePool = fs.readFileSync(path.join(__dirname, '../../balance/customerMoneySourcePoolService.js'), 'utf8');
const sharedLock = fs.readFileSync(path.join(__dirname, '../../shared/customerMoneyTransactionLock.js'), 'utf8');
const receiveService = fs.readFileSync(path.join(__dirname, '../../receive/receiveCustomerMoneyService.js'), 'utf8');
const salePaymentProjection = fs.readFileSync(path.join(__dirname, '../../../sales/completion/services/salePaymentPostingService.js'), 'utf8');
const saleCompletionService = fs.readFileSync(path.join(__dirname, '../../../sales/completion/services/saleCompletionService.js'), 'utf8');
const creditReceivableAuthority = fs.readFileSync(path.join(__dirname, '../../../sales/shared/creditReceivableAuthority.js'), 'utf8');
const schema = fs.readFileSync(path.join(__dirname, '../../../../../prisma/customer/customer-money.prisma'), 'utf8');
const migration = fs.readFileSync(path.join(__dirname, '../../../../../prisma/migrations/20260812014000_customer_money_settlement_idempotency/migration.sql'), 'utf8');

test('eligible delivery credit query is branch and customer scoped', () => {
  assert.match(queryService, /branchId:\s*command\.branchId/);
  assert.match(queryService, /customerId:\s*command\.customerId/);
  assert.match(queryService, /buildActiveCreditReceivableWhere/);
  assert.match(creditReceivableAuthority, /isCredit:\s*true/);
  assert.match(creditReceivableAuthority, /status:\s*\{\s*not:\s*'CANCELLED'\s*\}/);
  assert.match(creditReceivableAuthority, /'UNPAID', 'PARTIALLY_PAID'/);
});

test('credit completion can intentionally remain DRAFT so settlement must not exclude DRAFT by status allow-list', () => {
  assert.match(saleCompletionService, /CREDIT_SALE_STATUS = process\.env\.CREDIT_SALE_STATUS \|\| 'DRAFT'/);
  assert.match(queryService, /buildActiveCreditReceivableWhere/);
  assert.doesNotMatch(creditReceivableAuthority, /status:\s*\{\s*in:/);
});

test('write validation uses the same active credit sale eligibility', () => {
  assert.match(createService, /buildActiveCreditReceivableWhere/);
});

test('eligible delivery credit query is read-only and derives customer money from source authority', () => {
  assert.match(queryService, /prisma\.sale\.findMany/);
  assert.match(queryService, /calculateAvailableCustomerMoney/);
  assert.doesNotMatch(queryService, /\.create\(|\.update\(|\.delete\(/);
  assert.match(queryService, /lineType:\s*'STOCK'/);
  assert.match(queryService, /lineType:\s*'SIMPLE'/);
  assert.match(queryService, /outstandingAmount/);
});

test('settlement command supports multi-sale item-level partial application', () => {
  assert.match(contract, /lines\.map/);
  assert.match(contract, /saleId/);
  assert.match(contract, /saleItemId/);
  assert.match(contract, /lineType/);
  assert.match(contract, /amount/);
});

test('settlement command rejects the same sale line more than once', () => {
  assert.throws(
    () => parseCreateSettlementInput({
      customerId: 7,
      lines: [
        { saleId: 11, saleItemId: 101, lineType: 'stock', amount: 40 },
        { saleId: 11, saleItemId: 101, lineType: 'STOCK', amount: 30 },
      ],
    }, { branchId: 3, employeeId: 9 }),
    (error) => error?.code === 'DUPLICATE_SETTLEMENT_LINE' && error?.statusCode === 400,
  );
});

test('settlement command accepts a bounded idempotency key and hashes semantic payload deterministically', () => {
  assert.equal(normalizeIdempotencyKey(' cms.retry-001 '), 'cms.retry-001');
  assert.throws(
    () => normalizeIdempotencyKey('bad key with spaces'),
    (error) => error?.code === 'INVALID_IDEMPOTENCY_KEY',
  );

  const left = parseCreateSettlementInput({
    customerId: 7,
    note: 'same',
    lines: [
      { saleId: 12, saleItemId: 202, lineType: 'simple', amount: 60 },
      { saleId: 11, saleItemId: 101, lineType: 'stock', amount: 40 },
    ],
  }, { branchId: 3, employeeId: 9 }, 'cms.retry-001');
  const right = parseCreateSettlementInput({
    customerId: 7,
    note: 'same',
    lines: [
      { saleId: 11, saleItemId: 101, lineType: 'STOCK', amount: 40 },
      { saleId: 12, saleItemId: 202, lineType: 'SIMPLE', amount: 60 },
    ],
  }, { branchId: 3, employeeId: 9 }, 'cms.retry-001');

  assert.equal(left.commandKey, 'cms.retry-001');
  assert.equal(buildSettlementRequestHash(left), buildSettlementRequestHash(right));
});

test('settlement idempotency has durable schema and migration authority', () => {
  assert.match(schema, /model CustomerMoneySettlementCommand/);
  assert.match(schema, /@@unique\(\[branchId, commandKey\]\)/);
  assert.match(schema, /settlementId Int\s+@unique/);
  assert.match(migration, /CREATE TABLE "public"\."CustomerMoneySettlementCommand"/);
  assert.match(migration, /CustomerMoneySettlementCommand_branchId_commandKey_key/);
  assert.match(migration, /CustomerMoneySettlementCommand_settlementId_fkey/);
  assert.match(createService, /customerMoneySettlementCommand\.findUnique/);
  assert.match(createService, /customerMoneySettlementCommand\.create/);
  assert.match(createService, /IDEMPOTENCY_KEY_REUSED/);
  assert.match(controller, /X-Idempotency-Key/);
  assert.match(controller, /idempotentReplay \? 200 : 201/);
});

test('settlement consumes receipt/deposit source projections instead of a free-floating balance', () => {
  assert.match(sourcePool, /sourceType:\s*'CUSTOMER_MONEY_RECEIPT'/);
  assert.match(sourcePool, /sourceType:\s*'CUSTOMER_DEPOSIT'/);
  assert.match(sourcePool, /remainingAmount:\s*\{ decrement: chunkAmount \}/);
  assert.match(sourcePool, /allocatedAmount:\s*\{ increment: chunkAmount \}/);
  assert.match(sourcePool, /status:\s*'FULLY_ALLOCATED'/);
  assert.match(sourcePool, /usedAmount:\s*\{ increment: chunkAmount \}/);
  assert.match(sourcePool, /getLegacyBalanceReservation/);
  assert.match(sourcePool, /getCustomerMoneySourceState/);
  assert.match(createService, /consumeCustomerMoneySources/);
  assert.match(createService, /sourceType:\s*allocation\.sourceType/);
  assert.match(createService, /sourceId:\s*allocation\.sourceId/);
  assert.doesNotMatch(createService, /sourceType:\s*'CUSTOMER_MONEY_BALANCE'/);
});

test('customer money receive and settlement mutations share one per-customer transaction lock authority', () => {
  assert.match(sharedLock, /CUSTOMER_MONEY_LOCK_NAMESPACE = -1003/);
  assert.match(sharedLock, /pg_advisory_xact_lock/);
  assert.match(createService, /acquireCustomerMoneyTransactionLock/);
  assert.match(cancelService, /acquireCustomerMoneyTransactionLock/);
  assert.match(receiveService, /acquireCustomerMoneyTransactionLock/);
  assert.match(receiveService, /RECEIPT_STATUSES = new Set\(\['ACTIVE', 'FULLY_ALLOCATED', 'CANCELLED'\]\)/);
});

test('legacy source reservations cannot be cancelled or spent through adjacent customer money flows', () => {
  assert.match(receiveService, /getCustomerMoneySourceState/);
  assert.match(receiveService, /sourceType:\s*'CUSTOMER_MONEY_RECEIPT'/);
  assert.match(receiveService, /sourceState\.legacyReservedAmount\.greaterThan\(0\)/);
  assert.match(receiveService, /CUSTOMER_MONEY_RECEIVE_LEGACY_RESERVED/);
  assert.match(salePaymentProjection, /getCustomerMoneySourceState/);
  assert.match(salePaymentProjection, /sourceType:\s*'CUSTOMER_DEPOSIT'/);
  assert.match(salePaymentProjection, /DEPOSIT_CUSTOMER_MONEY_RESERVED/);
});

test('settlement write is atomic and uses the shared sale payment projection', () => {
  assert.match(createService, /prisma\.\$transaction/);
  assert.match(createService, /customerMoneySettlement\.create/);
  assert.match(createService, /createCustomerMoneyApplication/);
  assert.match(createService, /eventType:\s*'MONEY_APPLIED'/);
  assert.match(createService, /direction:\s*'DEBIT'/);
  assert.match(createService, /updateCustomerMoneyBalance/);
  assert.match(createService, /projectSalePaymentStatus\(tx, saleId\)/);
  assert.doesNotMatch(createService, /tx\.sale\.update/);
});

test('shared sale payment projection includes active delivery credit settlements and serializes projection', () => {
  assert.match(salePaymentProjection, /pg_advisory_xact_lock/);
  assert.match(salePaymentProjection, /customerMoneySettlementLine\.aggregate/);
  assert.match(salePaymentProjection, /settlement:\s*\{ status: 'ACTIVE', settlementType: 'DELIVERY_CREDIT' \}/);
  assert.match(salePaymentProjection, /\.plus\(D\(settlementAggregate\._sum\.appliedAmount \|\| 0\)\)/);
  assert.match(salePaymentProjection, /data:\s*\{ paid, paidAt, paidAmount, statusPayment \}/);
});

test('settlement cancellation reverses source, application, ledger, balance and sale projection atomically', () => {
  assert.match(cancelService, /prisma\.\$transaction/);
  assert.match(cancelService, /restoreCustomerMoneySources/);
  assert.match(cancelService, /status:\s*'REVERSED'/);
  assert.match(cancelService, /status:\s*'CANCELLED'/);
  assert.match(cancelService, /eventType:\s*'MONEY_APPLICATION_REVERSED'/);
  assert.match(cancelService, /direction:\s*'CREDIT'/);
  assert.match(cancelService, /calculateAvailableCustomerMoney/);
  assert.match(cancelService, /projectSalePaymentStatus\(tx, saleId\)/);
  assert.match(route, /router\.post\('\/:id\/cancel'/);
});

test('settlement cancellation fails closed when a sale already has downstream document authority', () => {
  assert.match(cancelService, /combinedDocumentId/);
  assert.match(cancelService, /combinedBillingId/);
  assert.match(cancelService, /SETTLEMENT_DOWNSTREAM_DOCUMENT_EXISTS/);
});

test('settlement cancellation fails closed when a sale already has tax document authority', () => {
  assert.match(cancelService, /taxCandidate\.findMany/);
  assert.match(cancelService, /taxDocument\.findFirst/);
  assert.match(cancelService, /SETTLEMENT_TAX_DOCUMENT_EXISTS/);
  assert.match(cancelService, /status:\s*\{ notIn: \['CANCELLED', 'ARCHIVED'\] \}/);
});

test('fully paid referenced sales become tax-document ready without creating a new tax engine', () => {
  assert.match(detailQueryService, /salePaymentStates/);
  assert.match(detailQueryService, /statusPayment:\s*sale\.statusPayment/);
  assert.match(detailQueryService, /taxDocumentReady:[\s\S]*sale\.statusPayment === 'PAID'/);
  assert.doesNotMatch(detailQueryService, /taxDocument\.create|taxInvoice\.create/);
});

test('settlement write preserves stock and legacy receipt-allocation boundaries', () => {
  assert.doesNotMatch(createService, /stockItem\.update|stockMovement|inventory|customerReceiptAllocation\.create/);
  assert.match(createService, /targetType:\s*'DELIVERY_CREDIT'/);
  assert.match(route, /router\.post\('\/'/);
  assert.doesNotMatch(route, /customer-receipt|allocation/i);
});
