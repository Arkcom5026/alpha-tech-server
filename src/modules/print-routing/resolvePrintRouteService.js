async function resolvePrintRoute(request, dependencies = {}) {
  if (typeof dependencies.resolveRoute !== 'function') {
    return {
      routeStatus: 'UNAVAILABLE',
    };
  }

  const route = await dependencies.resolveRoute({
    branchId: request.branchId,
    documentPurposeCode: request.documentPurposeCode,
  });

  if (!route || route.status !== 'ACTIVE') {
    return {
      routeStatus: 'UNAVAILABLE',
    };
  }

  return {
    routeStatus: 'RESOLVED',
    targetType: route.targetType,
    deviceId: route.deviceId,
    capability: route.capability,
  };
}

module.exports = {
  resolvePrintRoute,
};
