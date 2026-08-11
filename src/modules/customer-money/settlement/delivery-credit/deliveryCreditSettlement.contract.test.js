'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { parseCreateSettlementInput } = require('./deliveryCreditSettlementContract');

const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');
const contract = read('deliveryCreditSettlementContract.js');
const queryService = read('listEligibleDeliveryCreditsService.js');
const createService = read('createDeliveryCreditSettlementService.js');
const detailQueryService = read('queryDeliveryCreditSettlementService.js');
const route = read('deliveryCreditSettlementRoute.js');
const sourcePool = fs.readFileSync(path.join(__dirname, '../../balance/customerMoneySourcePoolService.js'), 'utf8');
const salePaymentProjection = fs.readFileSync(path.join(__dirname, '../../../sales/completion/services/salePaymentPostingService.js'), 'utf8');

test('eligible delivery credit query is branch and customer scoped', () => {
  assert.match(queryService, /branchId:\s*command\.branchId/);
  assert.match(queryService, /customerId:\s*command\.customerId/);
  assert.match(queryService, /isCredit:\s*true/);
  assert.match(queryService, /status:\s*\{\s*not:\s*'CANCELLED'\s*\}/);
  assert.match(queryService, /statusPayment:\s*\{\s*in:\s*\['UNPAID', 'PARTIALLY_PAID'\]/);
});

test('write validation uses the same active credit sale eligibility', () => {
  assert.match(createService, /isCredit:\s*true/);
  assert.match(createService, /status:\s*\{\s*not:\s*'CANCELLED'\s*\}/);
  assert.match(createService, /statusPayment:\s*\{\s*in:\s*\['UNPAID', 'PARTIALLY_PAID'\]/);
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

test('settlement consumes receipt/deposit source projections instead of a free-floating balance', () => {
  assert.match(sourcePool, /sourceType:\s*'CUSTOMER_MONEY_RECEIPT'/);
  assert.match(sourcePool, /sourceType:\s*'CUSTOMER_DEPOSIT'/);
  assert.match(sourcePool, /remainingAmount:\s*\{ decrement: chunkAmount \}/);
  assert.match(sourcePool, /allocatedAmount:\s*\{ increment: chunkAmount \}/);
  assert.match(sourcePool, /usedAmount:\s*\{ increment: chunkAmount \}/);
  assert.match(createService, /consumeCustomerMoneySources/);
  assert.match(createService, /sourceType:\s*allocation\.sourceType/);
  assert.match(createService, /sourceId:\s*allocation\.sourceId/);
  assert.doesNotMatch(createService, /sourceType:\s*'CUSTOMER_MONEY_BALANCE'/);
});

test('settlement write is atomic and uses the shared sale payment projection', () => {
  assert.match(createService, /prisma\.\$transaction/);
  assert.match(createService, /pg_advisory_xact_lock/);
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