'use strict';

const { prisma } = require('../../../../../lib/prisma');
const {
  ResolvePrintDocumentPurposeService,
} = require('../../../document-purpose/resolve/resolvePrintDocumentPurposeService');
const {
  getOrCreatePresentationSnapshot,
} = require('../../../document-presentation/persistentPresentationSnapshotService');
const { getSaleQuotationReference } = require('../../lineage/saleQuotationReferenceService');

const fail = (code, message, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const positiveInt = (value, code, field) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) fail(code, `${field} must be a positive integer`);
  return parsed;
};

const amount = (value) => Number(value || 0);

const mapLine = ({ id, quantity, basePrice, discount, price, description, productName, barcode = null }) => ({
  id: Number(id),
  description: String(description || productName || '').trim() || 'Sale item',
  quantity: amount(quantity || 1),
  unitAmount: amount(basePrice),
  discountAmount: amount(discount),
  lineAmount: amount(price),
  barcode,
});

const projectSaleDeliveryNote = async ({ branchId, saleId }) => {
  const normalizedBranchId = positiveInt(branchId, 'SALE_BRANCH_REQUIRED', 'branchId');
  const normalizedSaleId = positiveInt(saleId, 'SALE_ID_REQUIRED', 'saleId');

  const sale = await prisma.sale.findFirst({
    where: { id: normalizedSaleId, branchId: normalizedBranchId },
    select: {
      id: true,
      code: true,
      officialDocumentNumber: true,
      soldAt: true,
      status: true,
      statusPayment: true,
      paid: true,
      isCredit: true,
      note: true,
      totalBeforeDiscount: true,
      totalDiscount: true,
      totalAmount: true,
      vat: true,
      vatRate: true,
      customer: {
        select: { name: true, companyName: true, departmentName: true, taxId: true, addressDetail: true },
      },
      branch: {
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          taxId: true,
          branchCode: true,
          isHeadOffice: true,
          documentHeaderConfig: true,
        },
      },
      items: {
        select: {
          id: true,
          basePrice: true,
          discount: true,
          price: true,
          documentDescription: true,
          stockItem: {
            select: {
              barcode: true,
              product: { select: { name: true } },
            },
          },
        },
      },
      simpleItems: {
        select: {
          id: true,
          quantity: true,
          basePrice: true,
          discount: true,
          price: true,
          documentDescription: true,
          product: { select: { name: true } },
        },
      },
    },
  });

  if (!sale) fail('SALE_NOT_FOUND', 'Sale not found', 404);
  if (sale.status === 'CANCELLED') {
    fail('DELIVERY_NOTE_SALE_CANCELLED', 'A cancelled sale cannot be printed as a delivery note', 409);
  }

  // Delivery Note authority is issuance-based, not payment/sale-completion based.
  // CREDIT sales are intentionally allowed to remain DRAFT while their receivable
  // and stock mutation are already authoritative. The deterministic document
  // number is the signal that this Sale was issued a Delivery Note.
  if (!sale.officialDocumentNumber) {
    fail(
      'DELIVERY_NOTE_NOT_ISSUED',
      'This sale has not been issued a delivery note',
      409,
    );
  }

  // Once any source line is absorbed into a non-cancelled consolidated delivery,
  // the original remains audit history but is no longer an active printable source.
  const consolidatedSource = await prisma.consolidatedDeliveryLine.findFirst({
    where: {
      branchId: normalizedBranchId,
      sourceSaleId: normalizedSaleId,
      status: 'DOCUMENTED',
      combinedBilling: { is: { status: { not: 'CANCELLED' } } },
    },
    select: { combinedBillingId: true },
  });
  if (consolidatedSource) {
    fail(
      'DELIVERY_NOTE_ALREADY_CONSOLIDATED',
      'This delivery note has already been consolidated and is no longer printable as an active source',
      409,
    );
  }

  const purpose = await new ResolvePrintDocumentPurposeService().execute({
    branchId: normalizedBranchId,
    code: 'DELIVERY_NOTE',
  });
  const quotationReference = await getSaleQuotationReference({
    saleId: normalizedSaleId,
    branchId: normalizedBranchId,
  });
  const presentationRecord = await getOrCreatePresentationSnapshot({
    branchId: normalizedBranchId,
    sourceType: 'SALE',
    sourceId: String(sale.id),
    documentPurpose: purpose.code,
    rendererFamily: 'A4',
    storeConfig: sale.branch.documentHeaderConfig,
    issuedAt: sale.soldAt,
    businessSnapshot: {
      saleId: sale.id,
      saleCode: sale.code,
      documentNumber: sale.officialDocumentNumber,
    },
  });

  const lines = [
    ...sale.items.map((item) => mapLine({
      ...item,
      quantity: 1,
      description: item.documentDescription,
      productName: item.stockItem.product.name,
      barcode: item.stockItem.barcode,
    })),
    ...sale.simpleItems.map((item) => mapLine({
      ...item,
      description: item.documentDescription,
      productName: item.product.name,
    })),
  ];

  return Object.freeze({
    document: {
      type: purpose.code,
      title: purpose.displayName,
      saleId: sale.id,
      saleCode: sale.code,
      documentNumber: sale.officialDocumentNumber,
      issuedAt: sale.soldAt,
      totalBeforeDiscount: amount(sale.totalBeforeDiscount),
      totalDiscount: amount(sale.totalDiscount),
      totalAmount: amount(sale.totalAmount),
      vatAmount: amount(sale.vat),
      vatRate: amount(sale.vatRate),
      paymentStatus: sale.statusPayment,
      isCredit: sale.isCredit === true,
      sourceQuotation: quotationReference ? {
        quotationId: quotationReference.quotationId,
        code: quotationReference.quotationCode,
        revisionNumber: quotationReference.quotationRevision,
        issuedAt: quotationReference.quotationIssuedAt,
      } : null,
    },
    issuer: {
      id: sale.branch.id,
      name: sale.branch.name,
      address: sale.branch.address,
      phone: sale.branch.phone,
      taxId: sale.branch.taxId,
      branchCode: sale.branch.branchCode,
      isHeadOffice: sale.branch.isHeadOffice,
    },
    recipient: {
      name: sale.customer?.companyName || sale.customer?.name || null,
      departmentName: sale.customer?.departmentName || null,
      contactName: sale.customer?.name || null,
      operationalAddress: sale.customer?.addressDetail || null,
      taxId: sale.customer?.taxId || null,
    },
    note: sale.note || null,
    lines,
    presentationSnapshot: presentationRecord.snapshot,
  });
};

module.exports = Object.freeze({ projectSaleDeliveryNote });
