'use strict';

const saleTaxDocumentEligibilityPolicy = require('./sources/sale/saleTaxDocumentEligibilityPolicy');
const saleReturnTaxCandidate = require('./sources/saleReturn/registerSaleReturnTaxCandidateService');

module.exports = Object.freeze({
  inputDocuments: Object.freeze({
    modes: require('./inputDocuments/contracts/inputTaxDocumentModeContract'),
    overview: Object.freeze({
      contract: require('./inputDocuments/overview/inputTaxOverviewContract'),
      query: require('./inputDocuments/overview/inputTaxOverviewService').getInputTaxOverview,
    }),
    pending: Object.freeze({
      query: require('./inputDocuments/pending/pendingInputTaxDocumentService').listPendingInputTaxDocuments,
    }),
    receiptLinks: require('./inputDocuments/links/inputTaxReceiptLinkService'),
  }),
  intake: Object.freeze({
    registerCandidate: require('./intake/registerTaxCandidateService').registerTaxCandidate,
    registerSaleCandidate:
      require('./sources/sale/registerSaleTaxCandidateService').registerSaleTaxCandidate,
    registerSaleReturnCandidate: saleReturnTaxCandidate.registerSaleReturnTaxCandidate,
    registerPurchaseReceiptCandidate:
      require('./sources/purchaseReceipt/registerPurchaseReceiptTaxCandidateService').registerPurchaseReceiptTaxCandidate,
    isSaleTaxDocumentEligible: saleTaxDocumentEligibilityPolicy.isSaleTaxDocumentEligible,
    normalizeSalePaymentStatus: saleTaxDocumentEligibilityPolicy.normalizePaymentStatus,
    routes: require('./http/taxIntakeRoutes'),
    service: require('./http/taxIntakeService'),
  }),
  candidates: Object.freeze({
    contracts: require('./candidates/contracts/taxCandidateContract'),
    mapping: require('./candidates/mapping/mapCandidateToTaxDocument'),
  }),
  documents: Object.freeze({
    contracts: require('./documents/contracts/taxDocumentContract'),
    lifecycle: require('./documents/lifecycle/taxDocumentLifecycle'),
    transition:
      require('./documents/lifecycle/transitionTaxDocumentService').transitionTaxDocument,
  }),
  periods: Object.freeze({
    routes: require('./periods/taxPeriodRoutes'),
    service: require('./periods/taxPeriodService'),
  }),
});
