'use strict';

/**
 * Public entry for the Tax domain.
 *
 * Capability owners must be exported here before external runtime code may
 * depend on them. Internal repositories remain private to their slices.
 */
module.exports = Object.freeze({
  candidates: Object.freeze({
    contracts: require('./candidates/contracts/taxCandidateContract'),
    mapping: require('./candidates/mapping/mapCandidateToTaxDocument'),
  }),
  documents: Object.freeze({
    contracts: require('./documents/contracts/taxDocumentContract'),
    lifecycle: require('./documents/lifecycle/taxDocumentLifecycle'),
  }),
  periods: Object.freeze({
    routes: require('./periods/taxPeriodRoutes'),
    service: require('./periods/taxPeriodService'),
  }),
});
