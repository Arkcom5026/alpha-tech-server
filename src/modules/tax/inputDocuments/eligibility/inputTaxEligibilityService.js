'use strict';

const { createEligibilityProjection } = require('./inputTaxEligibilityContract');

const amount = (value) => Number(value || 0);
const normalizeStatus = (value) => String(value || '').trim().toUpperCase();
const CANCELLED_STATUSES = new Set(['CANCELLED', 'VOIDED']);

const projectInputTaxEligibility = ({ document, reconciliation }) => {
  const grossVatAmount = amount(document?.vatAmount ?? document?.taxAmount);
  const snapshot = document?.snapshot || {};
  const configuredRate = Number(snapshot.inputTaxEligibilityRate);
  const hasConfiguredRate = Number.isFinite(configuredRate) && configuredRate >= 0 && configuredRate <= 100;
  const eligibilityRate = hasConfiguredRate ? configuredRate : 100;
  const manualStatus = normalizeStatus(snapshot.inputTaxEligibilityStatus);
  const reasonCodes = Array.isArray(snapshot.inputTaxEligibilityReasonCodes)
    ? snapshot.inputTaxEligibilityReasonCodes.map(normalizeStatus).filter(Boolean)
    : [];

  if (CANCELLED_STATUSES.has(normalizeStatus(document?.status))) {
    return createEligibilityProjection({
      status: 'INELIGIBLE', grossVatAmount, eligibleVatAmount: 0,
      ineligibleVatAmount: grossVatAmount, eligibilityRate: 0,
      reasonCodes: ['CANCELLED_DOCUMENT'],
    });
  }
  if (normalizeStatus(document?.status) === 'REPLACED') {
    return createEligibilityProjection({
      status: 'INELIGIBLE', grossVatAmount, eligibleVatAmount: 0,
      ineligibleVatAmount: grossVatAmount, eligibilityRate: 0,
      reasonCodes: ['REPLACED_DOCUMENT'],
    });
  }
  if (!reconciliation?.canApprove) {
    return createEligibilityProjection({
      status: 'PENDING_REVIEW', grossVatAmount, eligibleVatAmount: 0,
      ineligibleVatAmount: grossVatAmount, eligibilityRate: 0,
      reasonCodes: ['ALLOCATION_MISMATCH'],
    });
  }
  if (['INELIGIBLE', 'DEFERRED', 'SELECTED_FOR_FILING', 'FILED'].includes(manualStatus)) {
    const eligibleVatAmount = manualStatus === 'INELIGIBLE' ? 0 : grossVatAmount * (eligibilityRate / 100);
    return createEligibilityProjection({
      status: manualStatus,
      grossVatAmount,
      eligibleVatAmount,
      ineligibleVatAmount: grossVatAmount - eligibleVatAmount,
      eligibilityRate: grossVatAmount === 0 ? 0 : eligibilityRate,
      reasonCodes: reasonCodes.length ? reasonCodes : ['MANUAL_REVIEW_REQUIRED'],
      decidedAt: snapshot.inputTaxEligibilityDecidedAt || null,
      decidedByEmployeeId: snapshot.inputTaxEligibilityDecidedByEmployeeId || null,
    });
  }

  const eligibleVatAmount = grossVatAmount * (eligibilityRate / 100);
  const status = eligibilityRate >= 100 ? 'ELIGIBLE'
    : (eligibilityRate > 0 ? 'PARTIALLY_ELIGIBLE' : 'INELIGIBLE');
  return createEligibilityProjection({
    status,
    grossVatAmount,
    eligibleVatAmount,
    ineligibleVatAmount: grossVatAmount - eligibleVatAmount,
    eligibilityRate,
    reasonCodes: status === 'PARTIALLY_ELIGIBLE'
      ? [...new Set([...reasonCodes, 'PARTIAL_BUSINESS_USE'])]
      : reasonCodes,
    decidedAt: snapshot.inputTaxEligibilityDecidedAt || null,
    decidedByEmployeeId: snapshot.inputTaxEligibilityDecidedByEmployeeId || null,
  });
};

module.exports = Object.freeze({ projectInputTaxEligibility });