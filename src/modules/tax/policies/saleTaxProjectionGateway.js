const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');

const SALE_TAX_TREATMENTS = Object.freeze({
  STANDARD: 'STANDARD',
  EXEMPT: 'EXEMPT',
});

const SALE_TAX_PROJECTION_ACTIONS = Object.freeze({
  PROJECT: 'PROJECT',
  SKIP: 'SKIP',
});

const normalizeOptionalText = (value) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const resolveSaleTaxProjectionDecision = ({ sale }) => {
  if (!sale || typeof sale !== 'object' || Array.isArray(sale)) {
    throw new TaxDocumentContractError(
      'INVALID_SALE_TAX_GATEWAY_INPUT',
      'sale must be an object',
      { field: 'sale' },
    );
  }

  const treatment = sale.taxTreatment || SALE_TAX_TREATMENTS.STANDARD;

  if (!Object.values(SALE_TAX_TREATMENTS).includes(treatment)) {
    throw new TaxDocumentContractError(
      'INVALID_SALE_TAX_TREATMENT',
      'sale.taxTreatment is not supported',
      { treatment },
    );
  }

  if (treatment === SALE_TAX_TREATMENTS.EXEMPT) {
    const exemptionReason = normalizeOptionalText(sale.taxExemptionReason);

    if (!exemptionReason) {
      throw new TaxDocumentContractError(
        'SALE_TAX_EXEMPTION_REASON_REQUIRED',
        'Tax-exempt sale requires an explicit exemption reason',
        { field: 'sale.taxExemptionReason' },
      );
    }

    return Object.freeze({
      action: SALE_TAX_PROJECTION_ACTIONS.SKIP,
      treatment,
      reason: exemptionReason,
      saleType: sale.saleType || null,
    });
  }

  return Object.freeze({
    action: SALE_TAX_PROJECTION_ACTIONS.PROJECT,
    treatment,
    reason: null,
    saleType: sale.saleType || null,
  });
};

module.exports = {
  SALE_TAX_PROJECTION_ACTIONS,
  SALE_TAX_TREATMENTS,
  resolveSaleTaxProjectionDecision,
};
