'use strict';

const REQUIRED_METHODS = Object.freeze([
  'findForLifecycleCommand',
  'findCommandReplay',
  'executeLifecycleTransition',
]);

const assertLifecycleRepository = (repository) => {
  if (!repository || typeof repository !== 'object') {
    throw new TypeError('ProductReservation lifecycle repository is required');
  }

  for (const method of REQUIRED_METHODS) {
    if (typeof repository[method] !== 'function') {
      throw new TypeError(`ProductReservation lifecycle repository must implement ${method}()`);
    }
  }

  return repository;
};

module.exports = Object.freeze({
  REQUIRED_METHODS,
  assertLifecycleRepository,
});
