'use strict'

const { normalizeCopies } = require('./printDocumentJobContract')

const resolvePrintJobRouting = async ({
  routeResolver,
  branchId,
  documentPurposeCode,
  requestedCopies,
  legacyTargetDeviceId = null,
  legacyTargetProfileId = null,
}) => {
  if (!routeResolver) {
    return {
      copies: normalizeCopies(requestedCopies),
      targetDeviceId: legacyTargetDeviceId || null,
      targetProfileId: legacyTargetProfileId || null,
      routeSnapshot: null,
    }
  }
  const route = await routeResolver.execute({ branchId, documentPurposeCode })
  return {
    copies: requestedCopies == null ? route.copies : normalizeCopies(requestedCopies),
    targetDeviceId: route.targetDevice.deviceId,
    targetProfileId: String(route.printerProfile.id),
    routeSnapshot: route,
  }
}

module.exports = { resolvePrintJobRouting }
