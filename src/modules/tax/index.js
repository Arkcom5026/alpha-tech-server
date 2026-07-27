'use strict';

/**
 * Public entry for the Tax domain.
 *
 * Capability owners must be exported here before external runtime code may
 * depend on them. Internal repositories remain private to their slices.
 */
module.exports = Object.freeze({
  periods: Object.freeze({
    routes: require('./periods/taxPeriodRoutes'),
    service: require('./periods/taxPeriodService'),
  }),
});
