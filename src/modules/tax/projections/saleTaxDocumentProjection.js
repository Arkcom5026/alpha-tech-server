const {
  TAX_DOCUMENT_DIRECTIONS,
  TAX_DOCUMENT_SOURCE_TYPES,
  TAX_DOCUMENT_TYPES,
} = require('../contracts/taxDocumentSourceTypes');

const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');

const {
  buildTaxDocumentDraft,
} = require('../factories/taxDocumentFactory');

const requireObject = (value, field) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TaxDocumentContractError(
      'INVALID_SALE_TAX_PROJECTION',
      `${field} must be an object`,
      { field },
    );
  }

  return value;
};

const requirePositiveInteger = (value, field) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TaxDocumentContractError(
      'INVALID_SALE_TAX_PROJECTION',
      `${field} must be a positive integer`,
      { field, value },
    );
  }

  return value;
};

const resolveTaxDocumentType = (sale) => {
  if (sale.isTaxInvoice) {
    return TAX_DOCUMENT_TYPES.TAX_INVOICE;
  }

  return TAX_DOCUMENT_TYPES.ABBREVIATED_TAX_INVOICE;
};

const projectCompletedSaleToTaxDocument = ({
  sale,
  commandKey,
  correlationId = null,
  occurredAt = null,
}) => {
  requireObject(sale, 'sale');

  const saleId = requirePositiveInteger(sale.id, 'sale.id');
  const branchId = requirePositiveInteger(
    sale.branchId,
    'sale.branchId',
  );

  const totalAmount = Number(sale.totalAmount ?? 0);
  const vatAmount = Number(sale.vat ?? 0);
  const taxableAmount = totalAmount - vatAmount;

  if (!Number.isFinite(taxableAmount) || taxableAmount < 0) {
    throw new TaxDocumentContractError(
      'INVALID_SALE_TAX_PROJECTION',
      'Sale taxable amount cannot be derived safely',
      {
        totalAmount: sale.totalAmount,
        vatAmount: sale.vat,
      },
    );
  }

  const resolvedOccurredAt =
    occurredAt ||
    sale.completedAt ||
    sale.createdAt ||
    new Date();

  return buildTaxDocumentDraft({
    branchId,
    sourceType: TAX_DOCUMENT_SOURCE_TYPES.SALE,
    sourceId: String(saleId),
    sourceVersion: 1,
    documentType: resolveTaxDocumentType(sale),
    direction: TAX_DOCUMENT_DIRECTIONS.OUTPUT,
    documentNumber: sale.officialDocumentNumber || null,
    occurredAt: resolvedOccurredAt,
    currency: 'THB',
    subtotalAmount:
      sale.totalBeforeDiscount ?? taxableAmount,
    discountAmount: sale.totalDiscount ?? 0,
    taxableAmount,
    vatRate: sale.vatRate ?? 0,
    vatAmount,
    totalAmount,
    actorEmployeeId: sale.employeeId ?? null,
    correlationId,
    commandKey,
  });
};

module.exports = {
  projectCompletedSaleToTaxDocument,
  resolveTaxDocumentType,
};
