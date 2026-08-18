'use strict';

const normalizeOverride = (value) => {
  if (value === true || value === false) return value;
  return null;
};

const isQuotationWorkflowEnabled = (customer = {}) => {
  const override = normalizeOverride(customer.quotationWorkflowOverride);
  if (override !== null) return override;
  return String(customer.type || 'INDIVIDUAL').toUpperCase() === 'GOVERNMENT';
};

const projectQuotationWorkflowPolicy = (customer = {}) => ({
  quotationWorkflowOverride: normalizeOverride(customer.quotationWorkflowOverride),
  quotationWorkflowEnabled: isQuotationWorkflowEnabled(customer),
});

module.exports = Object.freeze({
  isQuotationWorkflowEnabled,
  normalizeOverride,
  projectQuotationWorkflowPolicy,
});
