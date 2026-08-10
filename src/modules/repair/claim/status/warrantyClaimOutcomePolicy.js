const ACTIVE_DEVICE_RESOLUTIONS = new Set([
  'REPAIRED',
  'RETURNED_UNCHANGED',
  'REJECTED',
]);

const RETIRED_DEVICE_RESOLUTIONS = new Set([
  'REPLACED',
  'CREDITED',
  'REFUNDED',
  'WRITTEN_OFF',
]);

function resolveWarrantyClaimOutcome(resolution) {
  const normalized = String(resolution || '').trim().toUpperCase();
  const deviceStatus = ACTIVE_DEVICE_RESOLUTIONS.has(normalized)
    ? 'ACTIVE'
    : RETIRED_DEVICE_RESOLUTIONS.has(normalized)
      ? 'RETIRED'
      : null;

  return {
    resolution: normalized,
    deviceStatus,
    passportEventType:
      normalized === 'REPLACED'
        ? 'WARRANTY_REPLACED'
        : normalized === 'CREDITED'
          ? 'WARRANTY_CREDITED'
          : 'WARRANTY_CLAIM_RESOLVED',
    consumeReplacementStockItem: normalized === 'REPLACED',
  };
}

module.exports = {
  resolveWarrantyClaimOutcome,
};
