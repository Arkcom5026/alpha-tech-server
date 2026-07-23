const dayjs = require('dayjs');
const { prisma, Prisma } = require('../../../../lib/prisma');
const { SALE_DOCUMENT_INCLUDE } = require('../contracts/saleDocument.include');
const { SalesError } = require('../errors/salesError');
const { postPaymentEvidence } = require('./paymentPosting.service');

const D = (value) => new Prisma.Decimal(Number(value || 0).toFixed(2));
const SALE_CODE_MAX_RETRY = Math.max(0, Number(process.env.SALE_CODE_MAX_RETRY || 3));
const CREDIT_SALE_STATUS = process.env.CREDIT_SALE_STATUS || 'DRAFT';

const generateSaleCode = async (tx, branchId, attempt) => {
  const now = dayjs();
  const prefix = `SL-${String(branchId).padStart(2, '0')}${now.format('YYMM')}`;
  const count = await tx.sale.count({
    where: {
      branchId,
      createdAt: { gte: now.startOf('month').toDate(), lt: now.endOf('month').toDate() },
    },
  });
  return `${prefix}-${String(count + 1 + attempt).padStart(4, '0')}`;
};

const loadResult = async (branchId, commandKey, replayed = true) => {
  const stored = await prisma.salesCompletionCommand.findUnique({
    where: { branchId_commandKey: { branchId, commandKey } },
    include: {
      sale: {
        include: SALE_DOCUMENT_INCLUDE,
      },
    },
  });
  if (!stored) return null;
  const payments = await prisma.payment.findMany({
    where: { saleId: stored.saleId, isCancelled: false },
    include: { items: true },
    orderBy: { receivedAt: 'asc' },
  });
  return canonicalResult(stored.sale, payments, replayed, commandKey);
};

const canonicalResult = (sale, payments, replayed, commandKey) => ({
  saleId: sale.id,
  sale,
  payments,
  paymentSummary: {
    totalAmount: Number(sale.totalAmount),
    paidAmount: Number(sale.paidAmount),
    statusPayment: sale.statusPayment,
    outstandingAmount: Math.max(0, Number(sale.totalAmount) - Number(sale.paidAmount)),
  },
  completionStatus: sale.statusPayment === 'PAID' ? 'COMPLETED_PAID' : 'COMPLETED_CREDIT',
  documentDefaults: {
    option: sale.isCredit ? 'DELIVERY_NOTE' : 'RECEIPT',
    deliveryNoteMode: sale.isCredit ? 'PRINT' : null,
  },
  idempotency: { commandId: commandKey, replayed },
});

const completeSale = async ({ command, branchId, employeeId }) => {
  const replay = await loadResult(branchId, command.commandKey);
  if (replay) {
    const existing = await prisma.salesCompletionCommand.findUnique({
      where: { branchId_commandKey: { branchId, commandKey: command.commandKey } },
      select: { requestHash: true },
    });
    if (existing.requestHash !== command.requestHash) {
      throw new SalesError(409, 'IDEMPOTENCY_PAYLOAD_MISMATCH', 'commandId was already used with a different payload');
    }
    return replay;
  }

  let lastError;
  for (let attempt = 0; attempt <= SALE_CODE_MAX_RETRY; attempt += 1) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const customer = command.sale.customerId
          ? await tx.customerProfile.findFirst({
              where: { id: command.sale.customerId },
              select: { id: true, paymentTerms: true, type: true },
            })
          : null;
        if (command.sale.customerId && !customer) {
          throw new SalesError(400, 'CUSTOMER_NOT_FOUND', 'Customer not found');
        }
        const stockIds = command.sale.items.map((item) => item.stockItemId);
        const stockItems = await tx.stockItem.findMany({
          where: { id: { in: stockIds }, branchId, status: 'IN_STOCK' },
          select: { id: true, productId: true },
        });
        if (stockItems.length !== stockIds.length) {
          const available = new Set(stockItems.map((item) => item.id));
          throw new SalesError(409, 'STOCK_CONFLICT', 'One or more stock items are no longer available', {
            unavailableStockItemIds: stockIds.filter((id) => !available.has(id)),
          });
        }
        const productByStock = new Map(stockItems.map((item) => [item.id, item.productId]));
        const code = await generateSaleCode(tx, branchId, attempt);
        const dueDate = command.sale.isCredit && Number.isInteger(customer?.paymentTerms)
          ? dayjs().add(customer.paymentTerms, 'day').toDate()
          : null;
        const saleType = command.sale.saleType ||
          (customer?.type === 'GOVERNMENT' ? 'GOVERNMENT' : customer?.type === 'ORGANIZATION' ? 'WHOLESALE' : 'NORMAL');
        const sale = await tx.sale.create({
          data: {
            code,
            branchId,
            employeeId,
            customerId: command.sale.customerId,
            totalBeforeDiscount: D(command.sale.totalBeforeDiscount),
            totalDiscount: D(command.sale.totalDiscount),
            totalAmount: D(command.sale.totalAmount),
            vat: D(command.sale.vat),
            vatRate: D(command.sale.vatRate),
            note: command.sale.note,
            isCredit: command.sale.isCredit,
            isTaxInvoice: command.sale.isTaxInvoice,
            saleType,
            dueDate,
            status: command.sale.isCredit ? CREDIT_SALE_STATUS : 'COMPLETED',
            paid: false,
            paidAmount: D(0),
            statusPayment: 'UNPAID',
            officialDocumentNumber: command.sale.isCredit && command.sale.deliveryNoteMode === 'PRINT' ? `DN-${code}` : null,
            items: {
              create: command.sale.items.map((item) => ({
                stockItemId: item.stockItemId,
                basePrice: D(item.basePrice),
                vatAmount: D(item.vatAmount),
                price: D(item.price),
                discount: D(item.discount),
                remark: item.remark,
                documentPrefix: item.documentPrefix,
                documentDescription: item.documentDescription,
                documentSuffix: item.documentSuffix,
              })),
            },
          },
        });
        const changed = await tx.stockItem.updateMany({
          where: { id: { in: stockIds }, branchId, status: 'IN_STOCK' },
          data: { status: 'SOLD', soldAt: new Date() },
        });
        if (changed.count !== stockIds.length) {
          throw new SalesError(409, 'STOCK_CONFLICT', 'Stock changed during completion');
        }
        await tx.stockMovement.createMany({
          data: stockIds.map((stockId) => ({
            productId: productByStock.get(stockId),
            branchId,
            type: 'SALE',
            qty: -1,
            note: `Sale ${code}`,
          })),
        });
        const paymentCode = `PM-C-${sale.id}-${command.requestHash.slice(0, 12)}`;
        const posted = await postPaymentEvidence(tx, {
          sale: { ...sale, customerId: command.sale.customerId },
          branchId,
          employeeId,
          payment: command.payment,
          code: paymentCode,
        });
        await tx.salesCompletionCommand.create({
          data: {
            branchId,
            commandKey: command.commandKey,
            requestHash: command.requestHash,
            saleId: sale.id,
          },
        });
        return { saleId: sale.id, payments: posted.payments };
      }, { timeout: 20000, maxWait: 20000 });
      const final = await loadResult(branchId, command.commandKey, false);
      if (!final) throw new SalesError(500, 'COMPLETION_RESULT_MISSING', 'Completion committed but result could not be loaded');
      return final;
    } catch (error) {
      lastError = error;
      const replayAfterRace = await loadResult(branchId, command.commandKey);
      if (replayAfterRace) return replayAfterRace;
      if (error?.code === 'P2002' && String(error?.meta?.target || '').includes('code') && attempt < SALE_CODE_MAX_RETRY) continue;
      throw error;
    }
  }
  throw lastError;
};

module.exports = { completeSale, loadResult, canonicalResult };
