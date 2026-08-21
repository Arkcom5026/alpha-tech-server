'use strict';

const { prisma } = require('../../../../lib/prisma');
const {
  round2,
  toLocalRange,
  toNum,
} = require('../../sales/shared/saleLegacyProjection');
const {
  calculateReturnedReceivableAmount,
  calculateNetReceivableTotal,
} = require('../../sales/shared/creditReceivableAuthority');
const {
  mergeDeliveryNoteLifecycleIntoHistoryRow,
} = require('../../sales/delivery-note/lifecycle/projectDeliveryNoteHistoryLifecycle');

const PURPOSES = new Set(['BILL', 'DELIVERY_NOTE']);
const CONSOLIDATED_SOURCE_TYPE = 'CONSOLIDATED_DELIVERY';
const SALE_SOURCE_TYPE = 'SALE';
const TAX_DOCUMENT_SOURCE_TYPE = 'TAX_DOCUMENT';
const OUTPUT_TAX_FULL_SOURCE_KIND = 'OUTPUT_TAX_FULL';
const OUTPUT_TAX_SHORT_SOURCE_KIND = 'OUTPUT_TAX_SHORT';

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

const normalizeTaxKind = (document) => String(
  document?.taxInvoiceKind || document?.snapshot?.requiredTaxInvoiceKind || '',
).trim().toUpperCase();

const taxSourceKind = (document) => (
  normalizeTaxKind(document) === 'SHORT'
    ? OUTPUT_TAX_SHORT_SOURCE_KIND
    : OUTPUT_TAX_FULL_SOURCE_KIND
);

const projectSaleRow = ({ sale, payment, taxDocument }) => {
  const totalAmount = round2(toNum(sale.totalAmount));
  const returnedAmount = round2(calculateReturnedReceivableAmount(sale));
  const billableAmount = round2(calculateNetReceivableTotal(sale));
  const storedPaid = sale.paidAmount == null ? null : toNum(sale.paidAmount);
  const paidAmount = round2(Math.max(storedPaid == null ? 0 : storedPaid, payment?.paidAmount || 0));
  const balanceAmount = round2(Math.max(0, billableAmount - paidAmount));
  const isFullyPaid = billableAmount > 0 && paidAmount >= billableAmount;

  return {
    id: sale.id,
    rowKind: 'SALE_RECEIPT',
    code: sale.code,
    officialDocumentNumber: sale.officialDocumentNumber || null,
    createdAt: sale.createdAt,
    soldAt: sale.soldAt || null,
    totalAmount,
    grossTotalAmount: totalAmount,
    returnedAmount,
    billableAmount,
    hasReturn: returnedAmount > 0,
    paidAmount,
    balanceAmount,
    paid: Boolean(sale.paid || isFullyPaid),
    hasPayment: paidAmount > 0,
    isFullyPaid,
    isPartiallyPaid: paidAmount > 0 && paidAmount < billableAmount,
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
    rowKind: 'CONSOLIDATED_BILLING',
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

const projectTaxDocumentRow = (document) => {
  const snapshot = document?.snapshot && typeof document.snapshot === 'object'
    ? document.snapshot
    : {};
  const recipient = snapshot?.recipient && typeof snapshot.recipient === 'object'
    ? snapshot.recipient
    : {};
  const issued = String(document?.status || '').toUpperCase() === 'REGISTERED'
    && Boolean(document?.issuedDocumentNumber);
  const kind = normalizeTaxKind(document);
  const totalAmount = round2(toNum(document?.totalAmount));
  const counterpartyName = snapshot?.counterpartyName || recipient?.legalName || '-';
  const sourceDocumentNo = document?.candidate?.sourceDocumentNo || document?.documentNumber || null;

  return {
    id: `tax-${document.id}`,
    rowKind: taxSourceKind(document),
    code: issued ? document.issuedDocumentNumber : (sourceDocumentNo || document.documentNumber || `Tax #${document.id}`),
    draftDocumentNumber: document.documentNumber || sourceDocumentNo || null,
    issuedTaxDocumentNumber: document.issuedDocumentNumber || null,
    createdAt: document.issuedAt || document.occurredAt || document.createdAt,
    soldAt: document.occurredAt || document.createdAt,
    totalAmount,
    grossAmount: totalAmount,
    paidAmount: totalAmount,
    balanceAmount: 0,
    changeAmount: 0,
    paid: issued,
    hasPayment: issued,
    isFullyPaid: issued,
    isPartiallyPaid: false,
    customerName: counterpartyName,
    companyName: counterpartyName,
    customerPhone: '',
    status: document.status,
    documentStatus: document.status,
    documentType: document.documentType,
    taxInvoiceKind: kind || null,
    taxDocumentId: document.id,
    sourceDocumentNo,
    sourceType: document?.candidate?.sourceType || null,
    sourceId: document?.candidate?.sourceId || null,
    sourceSaleId: positive(snapshot?.sourceSaleId),
    sourceSaleCode: snapshot?.sourceSaleCode || null,
    sourceDeliveryNoteNumber: snapshot?.sourceDeliveryNoteNumber || null,
    counterpartyTaxId: document.counterpartyTaxId || snapshot?.counterpartyTaxId || recipient?.taxId || null,
    documentSourceType: TAX_DOCUMENT_SOURCE_TYPE,
    documentSourceId: document.id,
    canManageTaxDocument: !issued,
    canPrintTaxDocument: issued,
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

const taxRowMatchesKeyword = (row, keyword) => {
  const value = String(keyword || '').trim().toLowerCase();
  if (!value) return true;
  return [
    row.code,
    row.draftDocumentNumber,
    row.issuedTaxDocumentNumber,
    row.sourceDocumentNo,
    row.sourceSaleCode,
    row.sourceDeliveryNoteNumber,
    row.customerName,
    row.counterpartyTaxId,
    row.sourceId,
  ].some((candidate) => String(candidate || '').toLowerCase().includes(value));
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
      select: { sourceSaleId: true, combinedBillingId: true },
      distinct: ['sourceSaleId'],
    });
    const consumedSaleIds = consumedSourceRows.map((row) => row.sourceSaleId);
    const activeConsolidationBySaleId = new Map(
      consumedSourceRows.map((row) => [
        Number(row.sourceSaleId),
        { combinedBillingId: Number(row.combinedBillingId) },
      ]),
    );

    const consumedSourceExclusion = consumedSaleIds.length
      ? { id: { notIn: consumedSaleIds } }
      : {};

    const saleWhere = {
      branchId,
      status: { not: 'CANCELLED' },
      ...(purpose === 'DELIVERY_NOTE' ? {} : consumedSourceExclusion),
      ...(purpose === 'DELIVERY_NOTE' ? {
        officialDocumentNumber: { not: null },
      } : {}),
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

    const taxWhere = purpose === 'BILL'
      ? {
          branchId,
          documentType: 'OUTPUT_TAX_INVOICE',
          ...buildDateWhere(dateQuery, 'occurredAt'),
        }
      : null;

    const [sales, combinedDocuments, taxDocuments] = await Promise.all([
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
          items: { select: { id: true, price: true, returnedQuantity: true } },
          simpleItems: { select: { id: true, quantity: true, price: true, returnedQuantity: true } },
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
      taxWhere
        ? prisma.taxDocument.findMany({
            where: taxWhere,
            orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
            take: Math.min(Math.max(limit * 3, 100), 500),
            select: {
              id: true,
              documentType: true,
              documentNumber: true,
              counterpartyTaxId: true,
              status: true,
              issuedAt: true,
              occurredAt: true,
              createdAt: true,
              subtotalAmount: true,
              taxAmount: true,
              totalAmount: true,
              snapshot: true,
              taxInvoiceKind: true,
              issuedDocumentNumber: true,
              candidate: {
                select: {
                  sourceType: true,
                  sourceId: true,
                  sourceDocumentNo: true,
                },
              },
            },
          })
        : [],
    ]);

    const saleIds = sales.map((sale) => sale.id);
    const combinedIds = combinedDocuments.map((document) => String(document.id));
    const [payments, saleTaxCandidates, combinedTaxCandidates, preparations] = await Promise.all([
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
      purpose === 'DELIVERY_NOTE' && saleIds.length
        ? prisma.saleDocumentPreparation.findMany({
            where: {
              branchId,
              sourceType: SALE_SOURCE_TYPE,
              sourceId: { in: saleIds.map(String) },
            },
            select: { id: true, sourceId: true },
          })
        : [],
    ]);

    const preparedTaxCandidates = purpose === 'DELIVERY_NOTE' && preparations.length
      ? await prisma.taxCandidate.findMany({
          where: {
            branchId,
            sourceType: 'DOCUMENT_PREPARATION',
            OR: preparations.map((preparation) => ({
              sourceId: { startsWith: `${Number(preparation.id)}:` },
            })),
            document: {
              is: {
                documentType: 'OUTPUT_TAX_INVOICE',
                status: 'REGISTERED',
                issuedDocumentNumber: { not: null },
              },
            },
          },
          select: {
            sourceId: true,
            document: { select: { id: true, taxInvoiceKind: true, issuedDocumentNumber: true } },
          },
        })
      : [];

    const paymentBySaleId = aggregatePayments(payments);
    const saleTaxBySourceId = new Map(saleTaxCandidates.map((candidate) => [String(candidate.sourceId), candidate.document]));
    const combinedTaxBySourceId = new Map(combinedTaxCandidates.map((candidate) => [String(candidate.sourceId), candidate.document]));
    const saleIdByPreparationId = new Map(
      preparations.map((preparation) => [String(preparation.id), Number(preparation.sourceId)]),
    );
    const preparedTaxBySaleId = new Map();
    for (const candidate of preparedTaxCandidates) {
      const preparationId = String(candidate.sourceId || '').split(':')[0];
      const saleId = saleIdByPreparationId.get(preparationId);
      if (saleId && !preparedTaxBySaleId.has(saleId)) {
        preparedTaxBySaleId.set(saleId, candidate.document);
      }
    }

    let saleRows = sales.map((sale) => {
      const payment = paymentBySaleId.get(sale.id) || null;
      const taxDocument = saleTaxBySourceId.get(String(sale.id))
        || preparedTaxBySaleId.get(sale.id)
        || null;
      const row = projectSaleRow({ sale, payment, taxDocument });

      if (purpose !== 'DELIVERY_NOTE') return row;

      return mergeDeliveryNoteLifecycleIntoHistoryRow({
        row,
        sale,
        payment,
        taxDocument,
        activeConsolidation: activeConsolidationBySaleId.get(sale.id) || null,
      });
    });

    if (purpose === 'BILL' || boolQuery(req.query?.onlyPaid)) {
      saleRows = saleRows.filter((row) => row.isFullyPaid);
    }

    const combinedRows = combinedDocuments.map((document) => projectCombinedRow({
      document,
      taxDocument: combinedTaxBySourceId.get(String(document.id)) || null,
    }));

    const taxRows = purpose === 'BILL'
      ? taxDocuments.map(projectTaxDocumentRow).filter((row) => taxRowMatchesKeyword(row, keyword))
      : [];

    const rows = [...saleRows, ...combinedRows, ...taxRows]
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
  projectTaxDocumentRow,
  taxRowMatchesKeyword,
  aggregatePayments,
  PURPOSES,
  CONSOLIDATED_SOURCE_TYPE,
  SALE_SOURCE_TYPE,
  TAX_DOCUMENT_SOURCE_TYPE,
  OUTPUT_TAX_FULL_SOURCE_KIND,
  OUTPUT_TAX_SHORT_SOURCE_KIND,
};