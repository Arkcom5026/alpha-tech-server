'use strict';

const number = (value) => Number(value || 0);
const money = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;
const iso = (value) => value ? new Date(value).toISOString() : null;

const buildIssuedSnapshot = ({ quotation, documentHeaderSnapshot, customerSnapshot, issuedAt }) => ({
  schemaVersion: 3,
  quotationId: quotation.id,
  code: quotation.code,
  branchId: quotation.branchId,
  revisionNumber: Number(quotation.revisionNumber || 0),
  revisionRootId: quotation.revisionRootId || quotation.id,
  revisedFromId: quotation.revisedFromId || null,
  status: 'ISSUED',
  version: Number(quotation.version || 0) + 1,
  issuedAt: iso(issuedAt),
  issueDate: iso(quotation.issueDate || issuedAt),
  validUntil: iso(quotation.validUntil),
  subject: quotation.subject || null,
  introduction: quotation.introduction || null,
  closingNote: quotation.closingNote || null,
  notes: quotation.notes || null,
  paymentTerms: quotation.paymentTerms || null,
  documentHeader: documentHeaderSnapshot || null,
  customer: customerSnapshot || null,
  totals: {
    subtotal: money(quotation.subtotal),
    lineDiscountTotal: 0,
    billDiscount: 0,
    vatInclusive: true,
    vatEnabled: quotation.vatEnabled !== false,
    vatRate: number(quotation.vatRate),
    taxableBase: money(number(quotation.grandTotal) - number(quotation.vatAmount)),
    vatAmount: money(quotation.vatAmount),
    grandTotal: money(quotation.grandTotal),
  },
  items: (quotation.items || []).map((item) => ({
    id: item.id,
    sourceType: item.sourceType,
    sourceProductId: item.sourceProductId || null,
    title: item.title,
    description: item.description || null,
    quantity: number(item.quantity),
    unitName: item.unitName || null,
    unitPrice: money(item.unitPrice),
    discountAmount: 0,
    lineSubtotal: money(item.lineSubtotal),
    lineTotal: money(item.lineTotal),
    sortOrder: Number(item.sortOrder || 0),
  })),
});

module.exports = Object.freeze({ buildIssuedSnapshot });
