'use strict';

/**
 * Public entry for the Tax domain.
 *
 * Capability owners must be exported here before external runtime code may
 * depend on them. Internal repositories remain private to their slices.
 */
module.exports = Object.freeze({
  intake: Object.freeze({
    registerCandidate: require('./intake/registerTaxCandidateService').registerTaxCandidate,
    registerSaleCandidate: require('./sources/sale/registerSaleTaxCandidateService').registerSaleTaxCandidate,
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
    transition: require('./documents/lifecycle/transitionTaxDocumentService').transitionTaxDocument,
  }),
  periods: Object.freeze({
    routes: require('./periods/taxPeriodRoutes'),
    service: require('./periods/taxPeriodService'),
  }),
});
