'use strict';

const money = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const isoOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const resolveSnapshotLines = (snapshot) => {
  const lines = Array.isArray(snapshot?.lines) ? snapshot.lines : [];
  return Object.freeze(lines.map((line, index) => Object.freeze({
    lineNumber: Number(line.lineNumber) || index + 1,
    description: line.description || null,
    quantity: money(line.quantity),
    unitName: line.unitName || null,
    unitPrice: money(line.unitPrice),
    discountAmount: money(line.discountAmount),
    subtotalAmount: money(line.subtotalAmount),
    taxAmount: money(line.taxAmount),
    totalAmount: money(line.totalAmount),
    vatRate: line.vatRate == null ? null : money(line.vatRate),
    barcode: line.barcode || null,
    serialNumber: line.serialNumber || null,
    remark: line.remark || null,
  }))));
};

const buildTaxDocumentPrintProjection = ({ document }) => {
  if (!document || typeof document !== 'object') {
    throw Object.assign(new Error('Tax document is required'), {
      code: 'TAX_DOCUMENT_REQUIRED',
      statusCode: 400,
    });
  }

  const snapshot = document.snapshot || {};
  const issuer = snapshot.issuer || {};
  const counterparty = snapshot.counterparty || {};
  const totals = snapshot.totals || {};
  const source = snapshot.source || {};
  const commercial = snapshot.commercial || {};
  const lines = resolveSnapshotLines(snapshot);

  return Object.freeze({
    schemaVersion: 'TAX_DOCUMENT_PRINT_PROJECTION_V1',
    document: Object.freeze({
      id: document.id,
      documentType: document.documentType,
      documentNumber: document.documentNumber,
      status: document.status,
      issuedAt: isoOrNull(document.issuedAt),
      occurredAt: isoOrNull(document.occurredAt),
      currency: document.currency || commercial.currency || 'THB',
    }),
    source: Object.freeze({
      type: source.type || null,
      id: source.id || null,
      code: source.code || null,
      officialDocumentNumber: source.officialDocumentNumber || null,
      referenceCode: source.referenceCode || null,
    }),
    issuer: Object.freeze({
      branchId: issuer.branchId || document.branchId || null,
      branchCode: issuer.branchCode || null,
      branchName: issuer.branchName || null,
      taxId: issuer.taxId || null,
      isHeadOffice: Boolean(issuer.isHeadOffice),
      address: issuer.address || null,
      phone: issuer.phone || null,
    }),
    counterparty: Object.freeze({
      customerId: counterparty.customerId || null,
      displayName: counterparty.displayName || counterparty.companyName || counterparty.name || null,
      name: counterparty.name || null,
      companyName: counterparty.companyName || null,
      taxId: counterparty.taxId || document.counterpartyTaxId || null,
      customerType: counterparty.customerType || null,
      addressDetail: counterparty.addressDetail || null,
      subdistrictCode: counterparty.subdistrictCode || null,
      phone: counterparty.phone || null,
    }),
    totals: Object.freeze({
      beforeDiscountAmount: money(totals.beforeDiscountAmount),
      discountAmount: money(totals.discountAmount),
      subtotalAmount: money(document.subtotalAmount ?? totals.subtotalAmount),
      taxAmount: money(document.taxAmount ?? totals.taxAmount),
      totalAmount: money(document.totalAmount ?? totals.totalAmount),
      vatRate: money(totals.vatRate),
    }),
    vatBreakdown: Object.freeze(
      (Array.isArray(snapshot.vatBreakdown) ? snapshot.vatBreakdown : []).map((row) => Object.freeze({
        vatRate: money(row.vatRate),
        taxableAmount: money(row.taxableAmount),
        taxAmount: money(row.taxAmount),
        totalAmount: money(row.totalAmount),
      })),
    ),
    paymentSummary: Object.freeze({
      status: snapshot.paymentSummary?.status || commercial.paymentStatus || null,
      paidAmount: money(snapshot.paymentSummary?.paidAmount ?? commercial.paidAmount),
      methods: Object.freeze({ ...(snapshot.paymentSummary?.methods || {}) }),
      receiptCodes: Object.freeze([...(snapshot.paymentSummary?.receiptCodes || [])]),
    }),
    deliveryReference: Object.freeze({
      status: snapshot.deliveryReference?.status || null,
      deliveryIds: Object.freeze([...(snapshot.deliveryReference?.deliveryIds || [])]),
      completedAt: isoOrNull(snapshot.deliveryReference?.completedAt),
    }),
    lines,
    lineCount: lines.length,
    snapshotSchemaVersion: snapshot.schemaVersion || null,
  });
};

module.exports = Object.freeze({ buildTaxDocumentPrintProjection });
