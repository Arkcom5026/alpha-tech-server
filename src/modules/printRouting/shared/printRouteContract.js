export function createPrintRouteResolutionContract(input = {}) {
  return {
    branchId: input.branchId ?? null,
    documentPurposeCode: input.documentPurposeCode ?? null,
    targetType: input.targetType ?? null,
    deviceId: input.deviceId ?? null,
    capability: input.capability ?? null,
    routeStatus: input.routeStatus ?? 'UNRESOLVED',
  };
}

export function assertPrintRouteResolutionContract(value) {
  if (!value || typeof value !== 'object') {
    throw new Error('PRINT_ROUTE_CONTRACT_REQUIRED');
  }

  if (!value.documentPurposeCode) {
    throw new Error('PRINT_ROUTE_DOCUMENT_PURPOSE_REQUIRED');
  }

  return true;
}
