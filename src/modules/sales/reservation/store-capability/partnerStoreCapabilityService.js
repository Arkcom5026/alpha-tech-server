'use strict';

const repository = require('./partnerStoreCapabilityRepository');

const FEE_MODES = Object.freeze(['FREE', 'FIXED', 'NEGOTIATED']);
const AREA_MODES = Object.freeze(['PICKUP_ONLY', 'ADMIN_AREAS', 'DISTANCE', 'NATIONWIDE']);
const AREA_TYPES = Object.freeze(['PROVINCE', 'DISTRICT', 'SUBDISTRICT', 'POSTAL_CODE']);

const fail = (code, message, details) => {
  throw Object.assign(new Error(message), { statusCode: 400, code, details });
};
const text = (value, max = 255) => {
  const normalized = String(value || '').trim();
  return normalized ? normalized.slice(0, max) : null;
};
const bool = (value, fallback) => value === undefined ? fallback : Boolean(value);
const positiveInt = (value, fieldName, fallback) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) fail('PARTNER_STORE_INPUT_INVALID', `${fieldName} must be a positive integer`, { fieldName });
  return parsed;
};
const nonNegativeMoney = (value, fieldName) => {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed < 0) fail('PARTNER_STORE_INPUT_INVALID', `${fieldName} must be zero or greater`, { fieldName });
  return Math.round(parsed * 100) / 100;
};
const enumValue = (value, allowed, fieldName, fallback) => {
  const normalized = String(value || fallback || '').trim().toUpperCase();
  if (!allowed.includes(normalized)) fail('PARTNER_STORE_INPUT_INVALID', `Invalid ${fieldName}`, { fieldName, allowed });
  return normalized;
};

const normalizeAreas = (areas = []) => {
  if (!Array.isArray(areas)) fail('PARTNER_STORE_INPUT_INVALID', 'serviceAreas must be an array');
  const seen = new Set();
  return areas.map((area, index) => {
    const areaType = enumValue(area?.areaType, AREA_TYPES, `serviceAreas[${index}].areaType`);
    const areaCode = text(area?.areaCode, 50);
    if (!areaCode) fail('PARTNER_STORE_INPUT_INVALID', 'Service area code is required', { index });
    const key = `${areaType}:${areaCode}`;
    if (seen.has(key)) fail('PARTNER_STORE_SERVICE_AREA_DUPLICATE', 'Duplicate service area', { areaType, areaCode });
    seen.add(key);
    return { areaType, areaCode, areaName: text(area?.areaName, 255) };
  });
};

const normalizeCommand = (input = {}) => {
  const pickupEnabled = bool(input.pickupEnabled, true);
  const deliveryEnabled = bool(input.deliveryEnabled, false);
  if (!pickupEnabled && !deliveryEnabled) fail('PARTNER_STORE_FULFILLMENT_REQUIRED', 'At least one fulfillment method must be enabled');

  const serviceAreaMode = enumValue(input.serviceAreaMode, AREA_MODES, 'serviceAreaMode', deliveryEnabled ? 'ADMIN_AREAS' : 'PICKUP_ONLY');
  const deliveryFeeMode = deliveryEnabled ? enumValue(input.deliveryFeeMode, FEE_MODES, 'deliveryFeeMode', 'NEGOTIATED') : null;
  const fixedDeliveryFee = deliveryFeeMode === 'FIXED' ? nonNegativeMoney(input.fixedDeliveryFee, 'fixedDeliveryFee') : null;
  if (deliveryFeeMode === 'FIXED' && fixedDeliveryFee <= 0) fail('PARTNER_STORE_FIXED_FEE_REQUIRED', 'Fixed delivery fee must be greater than zero');
  if (!deliveryEnabled && serviceAreaMode !== 'PICKUP_ONLY') fail('PARTNER_STORE_DELIVERY_DISABLED', 'Delivery-disabled store must use PICKUP_ONLY service area');
  if (deliveryEnabled && serviceAreaMode === 'PICKUP_ONLY') fail('PARTNER_STORE_SERVICE_AREA_REQUIRED', 'Delivery-enabled store requires a delivery service area');

  const serviceAreas = normalizeAreas(input.serviceAreas);
  if (serviceAreaMode === 'ADMIN_AREAS' && serviceAreas.length === 0) fail('PARTNER_STORE_SERVICE_AREA_REQUIRED', 'ADMIN_AREAS requires at least one service area');
  if (serviceAreaMode !== 'ADMIN_AREAS' && serviceAreas.length > 0) fail('PARTNER_STORE_SERVICE_AREA_NOT_ALLOWED', 'Service-area rows are only allowed for ADMIN_AREAS');

  const maxDeliveryDistanceKm = serviceAreaMode === 'DISTANCE' ? Number(input.maxDeliveryDistanceKm) : null;
  if (serviceAreaMode === 'DISTANCE' && (!Number.isFinite(maxDeliveryDistanceKm) || maxDeliveryDistanceKm <= 0)) fail('PARTNER_STORE_DISTANCE_REQUIRED', 'DISTANCE mode requires maxDeliveryDistanceKm greater than zero');

  const storefrontEnabled = bool(input.storefrontEnabled, false);
  const storefrontSlug = text(input.storefrontSlug, 120)?.toLowerCase() || null;
  if (storefrontEnabled && !storefrontSlug) fail('PARTNER_STORE_SLUG_REQUIRED', 'Enabled storefront requires storefrontSlug');
  if (storefrontSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(storefrontSlug)) fail('PARTNER_STORE_SLUG_INVALID', 'storefrontSlug must use lowercase letters, numbers, and hyphens');

  return {
    branchId: positiveInt(input.branchId, 'branchId'),
    storefrontEnabled,
    storefrontSlug,
    displayName: text(input.displayName, 255),
    contactPhone: text(input.contactPhone, 50),
    pickupEnabled,
    deliveryEnabled,
    deliveryFeeMode,
    fixedDeliveryFee,
    serviceAreaMode,
    maxDeliveryDistanceKm,
    preparationSlaMinutes: positiveInt(input.preparationSlaMinutes, 'preparationSlaMinutes', 30),
    pickupInstruction: text(input.pickupInstruction ?? input.pickupInstructions, 2000),
    deliveryInstruction: text(input.deliveryInstruction ?? input.deliveryInstructions, 2000),
    serviceAreas,
  };
};

const getPartnerStoreCapability = async ({ branchId }) => {
  const normalizedBranchId = positiveInt(branchId, 'branchId');
  const capability = await repository.findByBranchId(normalizedBranchId);
  return capability || { branchId: normalizedBranchId, configured: false };
};
const savePartnerStoreCapability = (input) => repository.upsert(normalizeCommand(input));

module.exports = Object.freeze({
  FEE_MODES,
  AREA_MODES,
  AREA_TYPES,
  getPartnerStoreCapability,
  savePartnerStoreCapability,
});
