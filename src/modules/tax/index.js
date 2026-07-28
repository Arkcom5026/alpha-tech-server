'use strict';

module.exports = Object.freeze({
  inputDocuments: Object.freeze({
    modes: require('./inputDocuments/contracts/inputTaxDocumentModeContract'),
    pending: Object.freeze({
      query: require('./inputDocuments/pending/pendingInputTaxDocumentService').listPendingInputTaxDocuments,
    }),
    receiptLinks: require('./inputDocuments/links/inputTaxReceiptLinkService'),
  }),
  intake: Object.freeze({
    registerCandidate: require('./intake/registerTaxCandidateService').registerTaxCandidate,
    registerSaleCandidate:
      require('./sources/sale/registerSaleTaxCandidateService').registerSaleTaxCandidate,
    registerPurchaseReceiptCandidate:
      require('./sources/purchaseReceipt/registerPurchaseReceiptTaxCandidateService').registerPurchaseReceiptTaxCandidate,
    routes: require('./http/taxIntakeRoutes'),
    service: require('./http/taxIntakeService'),
  }),
  candidates: Object.freeze({
    contracts: require('./candidates/contracts/taxCandidateContract'),
    mapping: require('./candidates/mapping/mapCandidateToTaxDocument'),
    convert:
      require('./candidates/conversion/convertTaxCandidateService').convertTaxCandidate,
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
