import { createPrintRouteResolutionContract } from '../shared/printRouteContract.js';

/**
 * Print route authority boundary.
 *
 * This layer intentionally does not execute printing.
 * It only resolves the target required before a Print Job is created.
 */
export async function resolvePrintRoute({
  branchId,
  documentPurposeCode,
  routeResolver,
}) {
  if (typeof routeResolver !== 'function') {
    return createPrintRouteResolutionContract({
      branchId,
      documentPurposeCode,
      routeStatus: 'UNRESOLVED',
    });
  }

  const target = await routeResolver({
    branchId,
    documentPurposeCode,
  });

  return createPrintRouteResolutionContract({
    branchId,
    documentPurposeCode,
    targetType: 'DEVICE',
    deviceId: target?.deviceId ?? null,
    capability: target?.capability ?? null,
    routeStatus: target ? 'RESOLVED' : 'UNRESOLVED',
  });
}
