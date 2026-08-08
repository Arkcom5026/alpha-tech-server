async function createDocumentPrintJob(request, dependencies) {
  if (!request || !request.documentPurposeCode) {
    throw new Error('DOCUMENT_PURPOSE_REQUIRED');
  }

  const route = await dependencies.resolveRoute({
    branchId: request.branchId,
    documentPurposeCode: request.documentPurposeCode,
  });

  if (!route || route.routeStatus !== 'RESOLVED') {
    throw new Error('PRINT_ROUTE_UNRESOLVED');
  }

  if (route.targetType !== 'DEVICE' || !route.deviceId) {
    throw new Error('PRINT_TARGET_UNAVAILABLE');
  }

  return dependencies.createPrintJob({
    ...request,
    printTargetSnapshot: {
      targetType: route.targetType,
      target: {
        deviceId: route.deviceId,
        capability: route.capability,
      },
    },
  });
}

module.exports = { createDocumentPrintJob };
