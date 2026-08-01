const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;
const registered = [];
const fakeRouter = {
  use: (...args) => registered.push(['use', ...args]),
  post: (...args) => registered.push(['post', ...args]),
};

Module._load = function(request, parent, isMain) {
  if (request === 'express') return { Router: () => fakeRouter };
  if (request.endsWith('/middlewares/verifyToken')) return function verifyToken(_req, _res, next) { next(); };
  return originalLoad.call(this, request, parent, isMain);
};

const routes = require('../src/modules/inventory/recovery/missing-cost-resolution/runtime/routes/missingCostResolutionMutationRoutes');
Module._load = originalLoad;

assert.strictEqual(routes, fakeRouter);
assert.deepStrictEqual(registered.map(([method, path]) => [method, typeof path === 'string' ? path : '<middleware>']), [
  ['use', '<middleware>'],
  ['post', '/'],
  ['post', '/:resolutionId/evidence-versions'],
  ['post', '/:resolutionId/transitions'],
]);

const controller = require('../src/modules/inventory/recovery/missing-cost-resolution/runtime/controller/missingCostResolutionMutationController');
assert.strictEqual(typeof controller.createDraft, 'function');
assert.strictEqual(typeof controller.appendEvidence, 'function');
assert.strictEqual(typeof controller.transition, 'function');

const source = require('fs').readFileSync(
  require.resolve('../src/modules/inventory/recovery/missing-cost-resolution/runtime/routes/missingCostResolutionMutationRoutes'),
  'utf8',
);
assert.match(source, /router\.use\(verifyToken\)/);
assert.doesNotMatch(source, /delete\s*\(/i);
assert.doesNotMatch(source, /put\s*\(/i);
assert.doesNotMatch(source, /patch\s*\(/i);

console.log('missing cost resolution mutation HTTP contract passed');
