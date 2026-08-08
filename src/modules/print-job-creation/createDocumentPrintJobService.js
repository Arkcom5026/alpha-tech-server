const { resolvePrintRoute } = require('../print-routing/resolvePrintRouteService');

/**
 * Unified entry point for document print job creation.
 * Document callers do not select printer targets directly.
 */
async function createDocumentPrintJob(request, dependencies = {}) {
  const route = await resolvePrintRoute(request, dependencies);

  if (!route || route.routeStatus !== 'RESOLVED') {
    throw new Error('PRINT_ROUTE_UNAVAILABLE');
  }

  const snapshot = {
    documentPurposeCode: request.documentPurposeCode,
    target: {
      type: route.targetType,
      deviceId: route.deviceId,
      capability: route.capability,
    },
  };

  if (typeof dependencies.createPrintJob !== 'function') {
    throw new Error('PRINT_JOB_CREATOR_UNAVAILABLE');
  }

  return dependencies.createPrintJob({
    ...request,
    printTargetSnapshot: snapshot,
  });
}

module.exports = {
  createDocumentPrintJob,
};
