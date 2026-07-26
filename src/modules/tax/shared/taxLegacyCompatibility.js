const LEGACY_TAX_SURFACES = Object.freeze({
  SALE_FIELDS: 'Sale VAT, tax-invoice intent, and official document number',
  PURCHASE_RECEIPT_FIELDS: 'Purchase receipt supplier tax-invoice fields',
  SALES_TAX_REPORT: 'Legacy sales tax report routes and controller',
  INPUT_TAX_REPORT: 'Legacy input tax report routes and controller',
  BILL_PRINTING: 'Legacy bill and full-tax-invoice printing payloads',
});

const legacyTaxCompatibilityEnabled = () => true;

module.exports = {
  LEGACY_TAX_SURFACES,
  legacyTaxCompatibilityEnabled,
};
