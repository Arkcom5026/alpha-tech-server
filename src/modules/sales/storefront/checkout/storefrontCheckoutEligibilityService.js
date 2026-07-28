'use strict';

const repository = require('./storefrontCheckoutEligibilityRepository');

const fail = (statusCode, code, message, details) => {
  throw Object.assign(new Error(message), { statusCode, code, details });
};

const normalizeAreas = (areas) => (Array.isArray(areas) ? areas : [])
  .map((area) => ({
    areaType: String(area?.areaType || '').trim().toUpperCase(),
    areaCode: String(area?.areaCode || '').trim(),
  }))
  .filter((area) => area.areaType && area.areaCode);

const evaluateStorefrontCheckout = async ({ branchId, orderSource, fulfillmentMethod, storefrontSlug, destinationAreas, deliveryDistanceKm }) => {
  if (!['MARKETPLACE', 'STOREFRONT'].includes(orderSource)) return null;

  const policy = await repository.findCurrentPolicy({ branchId });
  if (!policy || !policy.storefrontEnabled) {
    fail(409, 'STOREFRONT_CHECKOUT_UNAVAILABLE', 'The selected store is not accepting online orders');
  }

  const normalizedSlug = String(storefrontSlug || '').trim().toLowerCase();
  if (normalizedSlug && normalizedSlug !== String(policy.storefrontSlug || '').toLowerCase()) {
    fail(409, 'STOREFRONT_BRANCH_MISMATCH', 'The storefront does not belong to the selected branch');
  }

  if (fulfillmentMethod === 'PICKUP') {
    if (!policy.pickupEnabled) fail(409, 'STOREFRONT_PICKUP_UNAVAILABLE', 'Pickup is not available for this store');
    return { deliveryFeeMode: null, deliveryFee: 0, preparationSlaMinutes: policy.preparationSlaMinutes || null };
  }

  if (!policy.deliveryEnabled) fail(409, 'STOREFRONT_DELIVERY_UNAVAILABLE', 'Delivery is not available for this store');

  if (policy.serviceAreaMode === 'ADMIN_AREAS') {
    const requested = normalizeAreas(destinationAreas);
    const allowed = new Set((policy.serviceAreas || []).map((area) => `${area.areaType}:${area.areaCode}`));
    const eligible = requested.some((area) => allowed.has(`${area.areaType}:${area.areaCode}`));
    if (!eligible) fail(409, 'STOREFRONT_SERVICE_AREA_UNAVAILABLE', 'The delivery address is outside the store service area');
  }

  if (policy.serviceAreaMode === 'DISTANCE') {
    const distance = Number(deliveryDistanceKm);
    const maximum = Number(policy.maxDeliveryDistanceKm);
    if (!Number.isFinite(distance) || distance < 0) {
      fail(400, 'STOREFRONT_DELIVERY_DISTANCE_REQUIRED', 'deliveryDistanceKm is required for distance-based delivery');
    }
    if (distance > maximum) fail(409, 'STOREFRONT_SERVICE_AREA_UNAVAILABLE', 'The delivery address is outside the maximum delivery distance');
  }

  const deliveryFeeMode = policy.deliveryFeeMode;
  const deliveryFee = deliveryFeeMode === 'FIXED' ? Number(policy.fixedDeliveryFee) : 0;
  return {
    deliveryFeeMode,
    deliveryFee: Number(deliveryFee.toFixed(2)),
    preparationSlaMinutes: policy.preparationSlaMinutes || null,
  };
};

module.exports = Object.freeze({ evaluateStorefrontCheckout });
