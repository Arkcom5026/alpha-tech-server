'use strict';

const { Prisma } = require('../../../../lib/prisma');
const { validateReceiveCustomerMoneyInput } = require('./receiveCustomerMoneyContract');
const { validateReceiveCustomerMoneyPolicy } = require('./receiveCustomerMoneyPolicy');
const {
  calculateAvailableCustomerMoney,
  getCustomerMoneySourceState,
} = require('../balance/customerMoneySourcePoolService');
const {
  acquireCustomerMoneyTransactionLock,
} = require('../shared/customerMoneyTransactionLock');
const {
  freezeFinanceOperationalPresentation,
} = require('../../document-presentation/financeOperationalPresentationSnapshotService');

const CUSTOMER_MONEY_RECEIPT_SOURCE = 'CUSTOMER_MONEY_RECEIPT';
const CUSTOMER_MONEY_RECEIPT_PURPOSE = 'CUSTOMER_MONEY_RECEIPT';

const buildError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const serializePresentationSnapshots = (snapshots = {}) => Object.fromEntries(
  Object.entries(snapshots).map(([rendererFamily, record]) => [rendererFamily, record?.snapshot || null]),
);

const serializeReceipt = (receipt) => ({
  id: receipt.id,
  documentNo: receipt.code,
  branchId: receipt.branchId,
  branch: receipt.branch || null,
  customerId: receipt.customerId,
  receivedAt: receipt.receivedAt,
  amount: Number(receipt.totalAmount),
  remainingAmount: Number(receipt.remainingAmount),
  paymentMethod: receipt.paymentMethod,
  paymentReference: receipt.referenceNo || null,
  description: receipt.note || '',
  status: receipt.status,
  customer: receipt.customer || null,
  receivedBy: receipt.createdByEmployeeProfile || (
    receipt.createdByEmployeeProfileId ? { id: receipt.createdByEmployeeProfileId } : null
  ),
  cancelledBy: receipt.cancelledByEmployeeProfile || (
    receipt.cancelledByEmployeeProfileId ? { id: receipt.cancelledByEmployeeProfileId } : null
  ),
  cancelledAt: receipt.cancelledAt || null,
  cancelReason: receipt.cancelReason || null,
  createdAt: receipt.createdAt,
  updatedAt: receipt.updatedAt,
});

const createDocumentCode = async (tx, branchId, receivedAt) => {
  if (tx?.$queryRaw) {
    await tx.$queryRaw`SELECT 1::int AS "locked" FROM (SELECT pg_advisory_xact_lock(${-1004}::int, ${Number(branchId)}::int)) AS advisory_lock`;
  }
  const date = receivedAt || new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const prefix = `CMR-${yy}${mm}${dd}-`;
  const count = await tx.customerReceipt.count({ where: { branchId, code: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
};

const sumAvailableDeposits = (deposits = []) => deposits.reduce(
  (sum, deposit) => sum.plus(
    new Prisma.Decimal(deposit?.totalAmount ?? 0)
      .minus(new Prisma.Decimal(deposit?.usedAmount ?? 0)),
  ),
  new Prisma.Decimal(0),
);

const sumAvailableMoneyReceipts = (receipts = []) => receipts.reduce(
  (sum, receipt) => sum.plus(new Prisma.Decimal(receipt?.remainingAmount ?? 0)),
  new Prisma.Decimal(0),
);

const ensureEmployeeInBranch = async (tx, { employeeId, branchId }) => {
  const employee = await tx.employeeProfile.findFirst({
    where: {
      id: employeeId,
      branchId,
      active: true,
      approved: true,
    },
    select: { id: true },
  });
  if (!employee) throw buildError('ไม่พบพนักงานผู้รับเงินในสาขานี้', 404, 'EMPLOYEE_NOT_FOUND');
  return employee;
};

const freezeCustomerMoneyReceiptPresentation = ({ tx, receipt }) => freezeFinanceOperationalPresentation({
  tx,
  branchId: receipt.branchId,
  sourceType: CUSTOMER_MONEY_RECEIPT_SOURCE,
  sourceId: receipt.id,
  documentPurpose: CUSTOMER_MONEY_RECEIPT_PURPOSE,
  issuedAt: receipt.receivedAt || receipt.createdAt || new Date(),
});

const receiveCustomerMoney = async ({ prisma, receiptRepository, createLedger, updateBalance, input, user }) => {
  if (!prisma?.$transaction) throw new TypeError('Prisma transaction client is required');
  const command = validateReceiveCustomerMoneyInput(input, user);
  validateReceiveCustomerMoneyPolicy({ amount: command.amount });
  const amount = new Prisma.Decimal(String(command.amount));

  return prisma.$transaction(async (tx) => {
    await acquireCustomerMoneyTransactionLock(tx, command.customerId, command.branchId);

    const customer = await tx.customerProfile.findFirst({
      where: { id: command.customerId, branchId: command.branchId }, select: { id: true },
    });
    if (!customer) throw buildError('ไม่พบลูกค้าในสาขานี้', 404, 'CUSTOMER_NOT_FOUND');

    await ensureEmployeeInBranch(tx, {
      employeeId: command.createdById,
      branchId: command.branchId,
    });

    const documentNo = await createDocumentCode(tx, command.branchId, command.receivedAt);
    const receipt = await receiptRepository({
      client: tx,
      data: {
        code: documentNo, branchId: command.branchId, customerId: command.customerId,
        receivedAt: command.receivedAt, totalAmount: amount, allocatedAmount: new Prisma.Decimal(0),
        remainingAmount: amount, paymentMethod: command.paymentMethod,
        referenceNo: command.paymentReference, note: command.description, status: 'ACTIVE',
        createdByEmployeeProfileId: command.createdById,
      },
    });

    const presentationSnapshots = await freezeCustomerMoneyReceiptPresentation({ tx, receipt });

    await createLedger({
      client: tx,
      data: {
        branchId: command.branchId, customerId: command.customerId, applicationId: null,
        eventType: 'MONEY_RECEIVED', amount, direction: 'CREDIT',
        referenceType: CUSTOMER_MONEY_RECEIPT_SOURCE, referenceId: receipt.id,
        createdById: command.createdById,
      },
    });

    const nextAvailable = await calculateAvailableCustomerMoney(tx, {
      branchId: command.branchId,
      customerId: command.customerId,
    });
    const balance = await updateBalance({
      client: tx, branchId: command.branchId, customerId: command.customerId, availableAmount: nextAvailable,
    });

    return {
      receipt: {
        ...serializeReceipt(receipt),
        presentationSnapshots: serializePresentationSnapshots(presentationSnapshots),
      },
      balance: { customerId: balance.customerId, availableAmount: Number(balance.availableAmount) },
    };
  });
};

const PAYMENT_METHODS = new Set(['CASH', 'TRANSFER', 'CARD', 'QR', 'E_WALLET', 'CHEQUE', 'OTHER', 'DEPOSIT']);
const RECEIPT_STATUSES = new Set(['ACTIVE', 'FULLY_ALLOCATED', 'CANCELLED']);

const parseHistoryDate = (value, endOfDay = false) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(`${raw}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const listCustomerMoneyReceives = async ({ prisma, listRepository, user, query = {} }) => {
  const branchId = Number(user?.branchId);
  if (!Number.isInteger(branchId) || branchId <= 0) throw buildError('ไม่พบสาขาของผู้ใช้งาน', 400, 'BRANCH_CONTEXT_REQUIRED');

  const customerId = Number(query.customerId);
  const statusCandidate = String(query.status || '').trim().toUpperCase();
  const paymentMethodCandidate = String(query.paymentMethod || '').trim().toUpperCase();
  const takeCandidate = Number(query.take);
  const take = Number.isInteger(takeCandidate) ? Math.min(Math.max(takeCandidate, 1), 500) : 100;

  const receipts = await listRepository({
    client: prisma,
    branchId,
    customerId: Number.isInteger(customerId) && customerId > 0 ? customerId : null,
    search: String(query.search || query.q || '').trim().slice(0, 120),
    status: RECEIPT_STATUSES.has(statusCandidate) ? statusCandidate : null,
    paymentMethod: PAYMENT_METHODS.has(paymentMethodCandidate) ? paymentMethodCandidate : null,
    dateFrom: parseHistoryDate(query.dateFrom),
    dateTo: parseHistoryDate(query.dateTo, true),
    take,
  });
  return receipts.map(serializeReceipt);
};

const getCustomerMoneyReceive = async ({ prisma, getRepository, user, id }) => {
  const branchId = Number(user?.branchId);
  const receiptId = Number(id);
  if (!Number.isInteger(branchId) || branchId <= 0) throw buildError('ไม่พบสาขาของผู้ใช้งาน', 400, 'BRANCH_CONTEXT_REQUIRED');
  if (!Number.isInteger(receiptId) || receiptId <= 0) throw buildError('รหัสเอกสารไม่ถูกต้อง', 400, 'INVALID_DOCUMENT_ID');

  const receipt = await getRepository({ client: prisma, id: receiptId, branchId });
  if (!receipt) throw buildError('ไม่พบเอกสารรับเงิน', 404, 'DOCUMENT_NOT_FOUND');

  const [availableBalance, presentationSnapshots] = await Promise.all([
    calculateAvailableCustomerMoney(prisma, {
      branchId,
      customerId: receipt.customerId,
    }),
    freezeCustomerMoneyReceiptPresentation({ tx: prisma, receipt }),
  ]);

  return {
    ...serializeReceipt(receipt),
    availableBalance: Number(availableBalance),
    presentationSnapshots: serializePresentationSnapshots(presentationSnapshots),
  };
};

const cancelCustomerMoneyReceive = async ({
  prisma,
  getRepository,
  createLedger,
  updateBalance,
  user,
  id,
  cancelReason,
}) => {
  const branchId = Number(user?.branchId);
  const employeeId = Number(user?.employeeId);
  const receiptId = Number(id);
  const reason = String(cancelReason || '').trim();

  if (!Number.isInteger(branchId) || branchId <= 0) throw buildError('ไม่พบสาขาของผู้ใช้งาน', 400, 'BRANCH_CONTEXT_REQUIRED');
  if (!Number.isInteger(employeeId) || employeeId <= 0) throw buildError('ไม่พบพนักงานผู้ยกเลิก', 400, 'EMPLOYEE_CONTEXT_REQUIRED');
  if (!Number.isInteger(receiptId) || receiptId <= 0) throw buildError('รหัสเอกสารไม่ถูกต้อง', 400, 'INVALID_DOCUMENT_ID');
  if (!reason) throw buildError('กรุณาระบุเหตุผลการยกเลิก', 400, 'CANCEL_REASON_REQUIRED');

  return prisma.$transaction(async (tx) => {
    await ensureEmployeeInBranch(tx, { employeeId, branchId });

    let receipt = await getRepository({ client: tx, id: receiptId, branchId });
    if (!receipt) throw buildError('ไม่พบเอกสารรับเงิน', 404, 'DOCUMENT_NOT_FOUND');

    await acquireCustomerMoneyTransactionLock(tx, receipt.customerId, receipt.branchId);
    receipt = await getRepository({ client: tx, id: receiptId, branchId });
    if (!receipt) throw buildError('ไม่พบเอกสารรับเงิน', 404, 'DOCUMENT_NOT_FOUND');
    if (receipt.status === 'CANCELLED') throw buildError('เอกสารรับเงินนี้ถูกยกเลิกแล้ว', 409, 'DOCUMENT_ALREADY_CANCELLED');

    const totalAmount = new Prisma.Decimal(receipt.totalAmount ?? 0);
    const allocatedAmount = new Prisma.Decimal(receipt.allocatedAmount ?? 0);
    const remainingAmount = new Prisma.Decimal(receipt.remainingAmount ?? 0);
    if (!allocatedAmount.equals(0) || !remainingAmount.equals(totalAmount)) {
      throw buildError(
        'ไม่สามารถยกเลิกเอกสารรับเงินที่ถูกนำไปใช้แล้ว',
        409,
        'CUSTOMER_MONEY_RECEIVE_ALREADY_USED',
      );
    }

    const sourceState = await getCustomerMoneySourceState(tx, {
      branchId,
      customerId: receipt.customerId,
      sourceType: CUSTOMER_MONEY_RECEIPT_SOURCE,
      sourceId: receiptId,
    });
    if (
      sourceState.uncoveredLegacyReservation.greaterThan(0)
      || sourceState.legacyReservedAmount.greaterThan(0)
    ) {
      throw buildError(
        'ไม่สามารถยกเลิกใบรับเงินที่กำลังรองรับรายการตัดยอด Customer Money เดิม',
        409,
        'CUSTOMER_MONEY_RECEIVE_LEGACY_RESERVED',
      );
    }

    await tx.customerReceipt.update({
      where: { id: receiptId },
      data: {
        status: 'CANCELLED',
        remainingAmount: new Prisma.Decimal(0),
        cancelledAt: new Date(),
        cancelledByEmployeeProfileId: employeeId,
        cancelReason: reason,
      },
    });

    await createLedger({
      client: tx,
      data: {
        branchId,
        customerId: receipt.customerId,
        applicationId: null,
        eventType: 'MONEY_RECEIVE_CANCELLED',
        amount: totalAmount,
        direction: 'DEBIT',
        referenceType: CUSTOMER_MONEY_RECEIPT_SOURCE,
        referenceId: receiptId,
        createdById: employeeId,
      },
    });

    const nextAvailable = await calculateAvailableCustomerMoney(tx, {
      branchId,
      customerId: receipt.customerId,
    });
    const balance = await updateBalance({
      client: tx,
      branchId,
      customerId: receipt.customerId,
      availableAmount: nextAvailable,
    });

    const cancelledReceipt = await getRepository({ client: tx, id: receiptId, branchId });
    return {
      receipt: serializeReceipt(cancelledReceipt),
      balance: { customerId: balance.customerId, availableAmount: Number(balance.availableAmount) },
    };
  });
};

module.exports = {
  receiveCustomerMoney,
  listCustomerMoneyReceives,
  getCustomerMoneyReceive,
  cancelCustomerMoneyReceive,
  sumAvailableDeposits,
  sumAvailableMoneyReceipts,
};
