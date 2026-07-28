'use strict';

const money = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const decimalQuantity = (value, fallback = 1) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const buildStructuredLine = (item, index) => {
  const quantity = 1;
  const basePrice = money(item.basePrice);
  const discountAmount = money(item.discount);
  const taxAmount = money(item.vatAmount);
  const totalAmount = money(item.price);

  return Object.freeze({
    lineNumber: index + 1,
    sourceLineType: 'STRUCTURED',
    sourceLineId: item.id,
    productId: item.stockItem?.product?.id || null,
    stockItemId: item.stockItemId,
    simpleLotId: null,
    sku: item.stockItem?.product?.saleBarcode || null,
    barcode: item.stockItem?.barcode || null,
    serialNumber: item.stockItem?.serialNumber || null,
    description:
      item.documentDescription ||
      item.stockItem?.product?.name ||
      item.remark ||
      `Sale item ${item.id}`,
    documentPrefix: item.documentPrefix || null,
    documentSuffix: item.documentSuffix || null,
    quantity,
    unitName: item.stockItem?.product?.unit?.name || null,
    unitPrice: basePrice,
    discountAmount,
    subtotalAmount: Math.max(0, basePrice - discountAmount),
    taxAmount,
    totalAmount,
    vatRate: null,
    remark: item.remark || null,
  });
};

const buildSimpleLine = (item, index) => {
  const quantity = decimalQuantity(item.quantity);
  const basePrice = money(item.basePrice);
  const discountAmount = money(item.discount);
  const taxAmount = money(item.vatAmount);
  const totalAmount = money(item.price);

  return Object.freeze({
    lineNumber: index + 1,
    sourceLineType: 'SIMPLE',
    sourceLineId: item.id,
    productId: item.productId,
    stockItemId: null,
    simpleLotId: item.simpleLotId || null,
    sku: item.product?.saleBarcode || null,
    barcode: null,
    serialNumber: null,
    description:
      item.documentDescription ||
      item.product?.name ||
      item.remark ||
      `Sale item ${item.id}`,
    documentPrefix: item.documentPrefix || null,
    documentSuffix: item.documentSuffix || null,
    quantity,
    unitName: item.product?.unit?.name || null,
    unitPrice: basePrice,
    discountAmount,
    subtotalAmount: Math.max(0, (basePrice * quantity) - discountAmount),
    taxAmount,
    totalAmount,
    vatRate: null,
    remark: item.remark || null,
  });
};

const paymentSummary = (payments = []) => {
  const activePayments = payments.filter((payment) => !payment.isCancelled);
  const methods = {};

  for (const payment of activePayments) {
    for (const item of payment.items || []) {
      const method = String(item.paymentMethod || 'UNKNOWN');
      methods[method] = money(methods[method]) + money(item.amount);
    }
  }

  return Object.freeze({
    status: null,
    paidAmount: activePayments.reduce(
      (sum, payment) => sum + (payment.items || []).reduce((inner, item) => inner + money(item.amount), 0),
      0,
    ),
    methods: Object.freeze(methods),
    receiptCodes: Object.freeze(activePayments.map((payment) => payment.code).filter(Boolean)),
  });
};

const buildSaleTaxSnapshot = ({ sale, publishedAt = new Date() }) => {
  const structuredLines = (sale.items || []).map(buildStructuredLine);
  const simpleLines = (sale.simpleItems || []).map((item, index) =>
    buildSimpleLine(item, structuredLines.length + index),
  );
  const lines = Object.freeze([...structuredLines, ...simpleLines]);
  const gross = money(sale.totalAmount);
  const taxAmount = money(sale.vat);
  const subtotalAmount = Math.max(0, gross - taxAmount);
  const payments = paymentSummary(sale.payments || []);

  return Object.freeze({
    schemaVersion: 'SALE_OUTPUT_TAX_SNAPSHOT_V1',
    publishedAt: new Date(publishedAt).toISOString(),
    source: Object.freeze({
      type: 'SALE',
      id: sale.id,
      code: sale.code,
      status: sale.status,
      soldAt: sale.soldAt,
      finalizedAt: sale.finalizedAt || null,
      officialDocumentNumber: sale.officialDocumentNumber || null,
      referenceCode: sale.refCode || null,
      saleType: sale.saleType || null,
      note: sale.note || null,
    }),
    issuer: Object.freeze({
      branchId: sale.branchId,
      branchCode: sale.branch?.branchCode || null,
      branchName: sale.branch?.name || null,
      taxId: sale.branch?.taxId || null,
      isHeadOffice: Boolean(sale.branch?.isHeadOffice),
      address: sale.branch?.address || null,
      phone: sale.branch?.phone || null,
    }),
    counterparty: Object.freeze({
      customerId: sale.customerId || null,
      name: sale.customer?.name || null,
      companyName: sale.customer?.companyName || null,
      displayName: sale.customer?.companyName || sale.customer?.name || null,
      taxId: sale.customer?.taxId || null,
      customerType: sale.customer?.type || null,
      addressDetail: sale.customer?.addressDetail || null,
      subdistrictCode: sale.customer?.subdistrictCode || null,
      phone: sale.customer?.user?.loginId || null,
    }),
    commercial: Object.freeze({
      isTaxInvoiceRequested: Boolean(sale.isTaxInvoice),
      isCredit: Boolean(sale.isCredit),
      dueDate: sale.dueDate || null,
      paymentStatus: sale.statusPayment,
      paid: Boolean(sale.paid),
      paidAt: sale.paidAt || null,
      paidAmount: money(sale.paidAmount),
      currency: 'THB',
    }),
    totals: Object.freeze({
      beforeDiscountAmount: money(sale.totalBeforeDiscount),
      discountAmount: money(sale.totalDiscount),
      subtotalAmount,
      taxAmount,
      totalAmount: gross,
      vatRate: money(sale.vatRate),
    }),
    vatBreakdown: Object.freeze([
      Object.freeze({
        vatRate: money(sale.vatRate),
        taxableAmount: subtotalAmount,
        taxAmount,
        totalAmount: gross,
      }),
    ]),
    paymentSummary: Object.freeze({
      ...payments,
      status: sale.statusPayment,
    }),
    deliveryReference: Object.freeze({
      status: null,
      deliveryIds: Object.freeze([]),
      completedAt: null,
    }),
    lines,
    lineCount: lines.length,
  });
};

module.exports = Object.freeze({ buildSaleTaxSnapshot });
