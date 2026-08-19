'use strict';

const { prisma } = require('../../../../lib/prisma');
const {
  round2,
  toLocalRange,
  toNum,
} = require('../../sales/shared/saleLegacyProjection');

const PURPOSES = new Set(['BILL', 'DELIVERY_NOTE']);
const CONSOLIDATED_SOURCE_TYPE = 'CONSOLIDATED_DELIVERY';
const SALE_SOURCE_TYPE = 'SALE';

const positive = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const boolQuery = (value) => ['1', 'true', 'yes', 'y'].includes(String(value ?? '').toLowerCase());

const clampLimit = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Math.min(Math.max(Number.isFinite(parsed) ? parsed : 100, 1), 500);
};

const buildDateWhere = ({ fromDate, toDate }, field) => {
  const fromRange = fromDate ? toLocalRange(String(fromDate)) : null;
  const toRange = toDate ? toLocalRange(String(toDate)) : null;
  if (!fromRange && !toRange) return {};
  return {
    [field]: {
      ...(fromRange ? { gte: fromRange.start } : {}),
      ...(toRange ? { lte: toRange.end } : {}),
    },
  };
};

const buildSaleKeywordWhere = (keyword) => {
  const value = String(keyword || '').trim();
  if (!value) return {};
  return {
    OR: [
      { code: { contains: value, mode: 'insensitive' } },
      { officialDocumentNumber: { contains: value, mode: 'insensitive' } },
      { note: { contains: value, mode: 'insensitive' } },
      { customer: { is: { name: { contains: value, mode: 'insensitive' } } } },
      { customer: { is: { companyName: { contains: value, mode: 'insensitive' } } } },
    ],
  };
};

const buildCombinedKeywordWhere = (keyword) => {
  const value = String(keyword || '').trim();
  if (!value) return {};
  return {
    OR: [
      { code: { contains: value, mode: 'insensitive' } },
      { note: { contains: value, mode: 'insensitive' } },
      { customer: { is: { name: { contains: value, mode: 'insensitive' } } } },
      { customer: { is: { companyName: { contains: value, mode: 'insensitive' } } } },
    ],
  };
};

const projectSaleRow = ({ sale, payment, taxDocument }) => {
  const totalAmount = round2(toNum(sale.totalAmount));
  const storedPaid = sale.paidAmount == null ? null : toNum(sale.paidAmount);
  const paidAmount = round2(Math.max(storedPaid == null ? 0 : storedPaid, payment?.paidAmount || 0));
  const balanceAmount = round2(Math.max(0, totalAmount - paidAmount));
  const isFullyPaid = totalAmount > 0 && paidAmount >= totalAmount;

  return {
    id: sale.id,
    code: sale.code,
    officialDocumentNumber: sale.officialDocumentNumber || null,
    createdAt: sale.createdAt,
    soldAt: sale.soldAt || null,
    totalAmount,
    paidAmount,
    balanceAmount,
    paid: Boolean(sale.paid || isFullyPaid),
    hasPayment: paidAmount > 0,
    isFullyPaid,
    isPartiallyPaid: paidAmount > 0 && paidAmount < totalAmount,
    lastPaidAt: payment?.lastPaidAt || null,
    customerName: sale.customer?.name || '-',
    companyName: sale.customer?.companyName || '-',
    customerPhone: sale.customer?.user?.loginId || '-',
    employeeName: sale.employee?.name || '-',
    status: sale.status,
    isCredit: Boolean(sale.isCredit),
    taxDocumentId: taxDocument?.id || null,
    taxInvoiceKind: taxDocument?.taxInvoiceKind || null,
    issuedTaxDocumentNumber: taxDocument?.issuedDocumentNumber || null,
    receiptPaymentId: payment?.receiptPaymentId || null,
    receiptNumber: payment?.receiptNumber || null,
    documentSourceType: SALE_SOURCE_TYPE,
    documentSourceId: sale.id,
  };
};

const projectCombinedRow = ({ document, taxDocument }) => {
  const totalAmount = round2(toNum(document.totalAmount));
  return {
    id: `combined-${document.id}`,
    code: document.code,
    officialDocumentNumber: document.code,
    createdAt: document.createdAt || document.issueDate,
    soldAt: document.issueDate || document.createdAt,
    totalAmount,
    paidAmount: totalAmount,
    balanceAmount: 0,
    paid: true,
    hasPayment: totalAmount > 0,
    isFullyPaid: true,
    isPartiallyPaid: false,
    lastPaidAt: document.issueDate || document.createdAt,
    customerName: document.customer?.name || '-',
    companyName: document.customer?.companyName || '-',
    customerPhone: document.customer?.user?.loginId || '-',
    employeeName: document.employee?.name || '-',
    status: document.status,
    isCredit: false,
    taxDocumentId: taxDocument?.id || null,
    taxInvoiceKind: taxDocument?.taxInvoiceKind || null,
    issuedTaxDocumentNumber: taxDocument?.issuedDocumentNumber || null,
    receiptPaymentId: null,
    receiptNumber: null,
    documentSourceType: CONSOLIDATED_SOURCE_TYPE,
    documentSourceId: document.id,
  };
};

const aggregatePayments = (payments) => {
  const bySaleId = new Map();
  for (const payment of payments) {
    const current = bySaleId.get(payment.saleId) || {
      paidAmount: 0,
      lastPaidAt: null,
      receiptPaymentId: null,
      receiptNumber: null,
    };
    const itemAmount = (Array.isArray(payment.items) ? payment.items : [])
      .reduce((sum, item) => sum + toNum(item.amount), 0);
    current.paidAmount = round2(current.paidAmount + itemAmount);
    if (!current.lastPaidAt || (payment.receivedAt && new Date(payment.receivedAt) > new Date(current.lastPaidAt))) {
      current.lastPaidAt = payment.receivedAt || current.lastPaidAt;
    }
    current.receiptPaymentId = current.receiptPaymentId || payment.id;
    current.receiptNumber = current.receiptNumber || payment.code;
    bySaleId.set(payment.saleId, current);
  }
  return bySaleId;
};

const unifiedDocumentHistory = async (req, res, next) => {
  try {
    const branchId = positive(req.user?.branchId);
    if (!branchId) {
      throw Object.assign(new Error('Branch context is required'), {
        statusCode: 401,
        code: 'BRANCH_CONTEXT_REQUIRED',
      });
    }

    const purpose = String(req.query?.documentPurpose || '').trim().toUpperCase();
    if (!PURPOSES.has(purpose)) {
      throw Object.assign(new Error('documentPurpose must be BILL or DELIVERY_NOTE'), {
        statusCode: 400,
        code: 'DOCUMENT_PURPOSE_INVALID',
      });
    }

    const keyword = String(req.query?.keyword || '').trim();
    const limit = clampLimit(req.query?.limit);
    const dateQuery = { fromDate: req.query?.fromDate, toDate: req.query?.toDate };

    const consumedSourceRows = await prisma.consolidatedDeliveryLine.findMany({
      where: {
        branchId,
        status: 'DOCUMENTED',
        combinedBilling: { is: { status: { not: 'CANCELLED' } } },
      },
      select: { sourceSaleId: true },
      distinct: ['sourceSaleId'],
    });
    const consumedSaleIds = consumedSourceRows.map((row) => row.sourceSaleId);

    // Once any source line enters a non-cancelled consolidated document, the
    // original Sale remains auditable but leaves both active Delivery Note and
    // Bill print lifecycles. Printing the source separately would duplicate a
    // commercial document after consolidation.
    const consumedSourceExclusion = consumedSaleIds.length
      ? { id: { notIn: consumedSaleIds } }
      : {};

    const saleWhere = {
      branchId,
      ...consumedSourceExclusion,
      ...(purpose === 'DELIVERY_NOTE'
        ? {
            // Discovery and opening must share the same eligibility authority.
            // projectSaleDeliveryNote requires a completed sale plus an issued
            // official document number, so history must never advertise a row
            // that the canonical print projection will reject with 409.
            status: 'COMPLETED',
            officialDocumentNumber: { not: null },
          }
        : {
            status: { not: 'CANCELLED' },
          }),
      ...buildSaleKeywordWhere(keyword),
      ...buildDateWhere(dateQuery, 'createdAt'),
    };

    const combinedWhere = {
      branchId,
      status: { not: 'CANCELLED' },
      documentLines: { some: { status: 'DOCUMENTED' } },
      ...buildCombinedKeywordWhere(keyword),
      ...buildDateWhere(dateQuery, 'issueDate'),
    };

    const [sales, combinedDocuments] = await Promise.all([
      prisma.sale.findMany({
        where: saleWhere,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select: {
          id: true,
          code: true,
          officialDocumentNumber: true,
          createdAt: true,
          soldAt: true,
          totalAmount: true,
          paidAmount: true,
          paid: true,
          status: true,
          isCredit: true,
          customer: { select: { name: true, companyName: true, user: { select: { loginId: true } } } },
          employee: { select: { name: true } },
        },
      }),
      prisma.combinedBillingDocument.findMany({
        where: combinedWhere,
        orderBy: [{ issueDate: 'desc' }, { id: 'desc' }],
        take: limit,
        include: {
          customer: { select: { name: true, companyName: true, user: { select: { loginId: true } } } },
          employee: { select: { name: true } },
        },
      }),
    ]);

    const saleIds = sales.map((sale) => sale.id);
    const combinedIds = combinedDocuments.map((document) => String(document.id));
    const [payments, saleTaxCandidates, combinedTaxCandidates] = await Promise.all([
      saleIds.length
        ? prisma.payment.findMany({
            where: { saleId: { in: saleIds }, isCancelled: false },
            orderBy: { receivedAt: 'desc' },
            select: {
              id: true,
              code: true,
              saleId: true,
              receivedAt: true,
              items: { select: { amount: true } },
            },
          })
        : [],
      saleIds.length
        ? prisma.taxCandidate.findMany({
            where: {
              branchId,
              sourceType: SALE_SOURCE_TYPE,
              sourceId: { in: saleIds.map(String) },
              document: { is: { documentType: 'OUTPUT_TAX_INVOICE', status: 'REGISTERED', issuedDocumentNumber: { not: null } } },
            },
            select: { sourceId: true, document: { select: { id: true, taxInvoiceKind: true, issuedDocumentNumber: true } } },
          })
        : [],
      combinedIds.length
        ? prisma.taxCandidate.findMany({
            where: {
              branchId,
              sourceType: CONSOLIDATED_SOURCE_TYPE,
              sourceId: { in: combinedIds },
              document: { is: { documentType: 'OUTPUT_TAX_INVOICE', status: 'REGISTERED', issuedDocumentNumber: { not: null } } },
            },
            select: { sourceId: true, document: { select: { id: true, taxInvoiceKind: true, issuedDocumentNumber: true } } },
          })
        : [],
    ]);

    const paymentBySaleId = aggregatePayments(payments);
    const saleTaxBySourceId = new Map(saleTaxCandidates.map((candidate) => [String(candidate.sourceId), candidate.document]));
    const combinedTaxBySourceId = new Map(combinedTaxCandidates.map((candidate) => [String(candidate.sourceId), candidate.document]));

    let saleRows = sales.map((sale) => projectSaleRow({
      sale,
      payment: paymentBySaleId.get(sale.id) || null,
      taxDocument: saleTaxBySourceId.get(String(sale.id)) || null,
    }));

    if (purpose === 'BILL' || boolQuery(req.query?.onlyPaid)) {
      saleRows = saleRows.filter((row) => row.isFullyPaid);
    }

    const combinedRows = combinedDocuments.map((document) => projectCombinedRow({
      document,
      taxDocument: combinedTaxBySourceId.get(String(document.id)) || null,
    }));

    const rows = [...saleRows, ...combinedRows]
      .sort((left, right) => new Date(right.createdAt || right.soldAt || 0) - new Date(left.createdAt || left.soldAt || 0))
      .slice(0, limit);

    return res.json(rows);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  unifiedDocumentHistory,
  projectSaleRow,
  projectCombinedRow,
  aggregatePayments,
  PURPOSES,
  CONSOLIDATED_SOURCE_TYPE,
  SALE_SOURCE_TYPE,
};
