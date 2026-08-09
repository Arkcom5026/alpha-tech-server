'use strict';

const FALLBACK_STANDARD_VAT_RATE_PERCENT = 7;

const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const percent = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 10000) / 10000;

const configuredStandardRate = () => {
  const configured = Number(process.env.THAILAND_STANDARD_VAT_RATE_PERCENT);
  return Number.isFinite(configured) && configured >= 0
    ? configured
    : FALLBACK_STANDARD_VAT_RATE_PERCENT;
};

const normalizeTreatment = (value) => {
  const treatment = String(value || '').trim().toUpperCase();
  return ['STANDARD_RATE', 'ZERO_RATED', 'EXEMPT', 'NON_VAT'].includes(treatment)
    ? treatment
    : null;
};

const resolveInputTaxReceiptVatPolicy = ({
  sourceSubtotalAmount = 0,
  sourceVatAmount = 0,
  sourceTotalAmount = 0,
  taxTreatment = null,
  vatPriceMode = null,
} = {}) => {
  const subtotal = money(sourceSubtotalAmount);
  const vat = money(sourceVatAmount);
  const total = money(sourceTotalAmount);
  const explicitTreatment = normalizeTreatment(taxTreatment);

  if (explicitTreatment && explicitTreatment !== 'STANDARD_RATE') {
    return {
      treatment: explicitTreatment,
      ratePercent: 0,
      priceMode: 'INCLUSIVE',
      autoCalculate: true,
      authority: 'SOURCE_TAX_TREATMENT',
    };
  }

  if (vat > 0 && subtotal > 0) {
    return {
      treatment: 'STANDARD_RATE',
      ratePercent: percent((vat / subtotal) * 100),
      priceMode: String(vatPriceMode || 'SOURCE_SPLIT').toUpperCase(),
      autoCalculate: false,
      authority: 'SOURCE_AMOUNTS',
    };
  }

  if (total > 0) {
    return {
      treatment: 'STANDARD_RATE',
      ratePercent: configuredStandardRate(),
      priceMode: String(vatPriceMode || 'INCLUSIVE').toUpperCase(),
      autoCalculate: true,
      authority: 'THAILAND_STANDARD_DEFAULT',
    };
  }

  return {
    treatment: explicitTreatment || 'UNKNOWN',
    ratePercent: explicitTreatment === 'STANDARD_RATE' ? configuredStandardRate() : 0,
    priceMode: String(vatPriceMode || 'UNKNOWN').toUpperCase(),
    autoCalculate: false,
    authority: 'INSUFFICIENT_SOURCE_SEMANTICS',
  };
};

module.exports = Object.freeze({
  resolveInputTaxReceiptVatPolicy,
});
