'use strict';

const repository = require('./storeExperienceDraftRepository');

const EDITABLE_STATUSES = ['DRAFT', 'READY'];

const THEME_PRESETS = new Set(['platform-default', 'modern-light', 'classic-slate']);
const LAYOUT_PRESETS = new Set(['platform-default', 'catalog-grid', 'catalog-list']);
const SECTION_TYPES = new Set(['HERO', 'FEATURED_PRODUCTS', 'PRODUCT_GRID', 'CONTACT', 'FULFILLMENT']);
const TOKEN_KEYS = new Set(['brandPrimary', 'brandAccent', 'surface', 'text']);
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const fail = (statusCode, code, message) => {
  throw Object.assign(new Error(message), { statusCode, code });
};

const normalizePreset = (value, allowed, field) => {
  if (value === undefined) return undefined;
  const normalized = String(value || '').trim().toLowerCase();
  if (!allowed.has(normalized)) fail(400, 'STORE_EXPERIENCE_VALIDATION_FAILED', `${field} à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡`);
  return normalized;
};

const normalizeThemeTokens = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    fail(400, 'STORE_EXPERIENCE_VALIDATION_FAILED', 'themeTokens à¸•à¹‰à¸­à¸‡à¹€à¸›à¹‡à¸™ object');
  }
  const entries = Object.entries(value);
  if (entries.some(([key, color]) => !TOKEN_KEYS.has(key) || typeof color !== 'string' || !HEX_COLOR.test(color))) {
    fail(400, 'STORE_EXPERIENCE_VALIDATION_FAILED', 'themeTokens à¸¡à¸µ token à¸«à¸£à¸·à¸­à¸„à¹ˆà¸²à¸ªà¸µà¸—à¸µà¹ˆà¹„à¸¡à¹ˆà¸£à¸­à¸‡à¸£à¸±à¸š');
  }
  return Object.fromEntries(entries.map(([key, color]) => [key, color.toLowerCase()]));
};

const normalizeSections = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Array.isArray(value) || value.length > 12) {
    fail(400, 'STORE_EXPERIENCE_VALIDATION_FAILED', 'sectionConfiguration à¸•à¹‰à¸­à¸‡à¸¡à¸µ sections à¹„à¸¡à¹ˆà¹€à¸à¸´à¸™ 12 à¸£à¸²à¸¢à¸à¸²à¸£');
  }
  const seen = new Set();
  return value.map((section, index) => {
    const id = String(section?.id || '').trim();
    const type = String(section?.type || '').trim().toUpperCase();
    if (!id || !/^[a-z0-9-]{1,80}$/i.test(id) || !SECTION_TYPES.has(type) || seen.has(id)) {
      fail(400, 'STORE_EXPERIENCE_VALIDATION_FAILED', `sectionConfiguration[${index}] à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡`);
    }
    if (section.enabled !== undefined && typeof section.enabled !== 'boolean') {
      fail(400, 'STORE_EXPERIENCE_VALIDATION_FAILED', `sectionConfiguration[${index}].enabled à¸•à¹‰à¸­à¸‡à¹€à¸›à¹‡à¸™ boolean`);
    }
    seen.add(id);
    return { id, type, enabled: section.enabled !== false };
  });
};

const normalizeContentConfiguration = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    fail(400, 'STORE_EXPERIENCE_VALIDATION_FAILED', 'contentConfiguration à¸•à¹‰à¸­à¸‡à¹€à¸›à¹‡à¸™ object');
  }
  return value;
};

const normalizeDraft = (payload = {}) => ({
  themePreset: normalizePreset(payload.themePreset, THEME_PRESETS, 'themePreset'),
  themeTokens: normalizeThemeTokens(payload.themeTokens),
  layoutPreset: normalizePreset(payload.layoutPreset, LAYOUT_PRESETS, 'layoutPreset'),
  sectionConfiguration: normalizeSections(payload.sectionConfiguration),
  contentConfiguration: normalizeContentConfiguration(payload.contentConfiguration),
});

const defaults = (branchId) => ({
  branchId,
  status: 'DRAFT',
  themePreset: 'platform-default',
  themeTokens: null,
  layoutPreset: 'platform-default',
  sectionConfiguration: null,
  contentConfiguration: null,
  version: 1,
  publishedVersion: null,
  publishedAt: null,
});

const getDraftForBranch = async (branchId) => {
  const existing = await repository.findByBranchId(branchId);
  return existing || defaults(branchId);
};

const saveDraftForBranch = async (branchId, payload) => {
  const existing = await repository.findByBranchId(branchId);
  if (existing?.status && !EDITABLE_STATUSES.includes(existing.status)) {
    fail(409, 'STORE_EXPERIENCE_NOT_EDITABLE', 'à¸«à¸™à¹‰à¸²à¸£à¹‰à¸²à¸™à¸–à¸¹à¸à¸£à¸°à¸‡à¸±à¸šà¹à¸¥à¸°à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¹à¸à¹‰à¹„à¸‚à¹„à¸”à¹‰');
  }
  const normalized = Object.fromEntries(Object.entries(normalizeDraft(payload)).filter(([, value]) => value !== undefined));
  const current = existing || defaults(branchId);
  const next = { ...current, ...normalized };
  const update = {
    ...normalized,
    status: existing?.status || 'DRAFT',
    version: (existing?.version || 1) + 1,
  };
  return repository.upsertDraftForBranch({
    branchId,
    create: { ...next, version: 1 },
    update,
  });
};

const publishForBranch = async (branchId) => {
  const [experience, capability] = await Promise.all([
    repository.findByBranchId(branchId),
    repository.findCapabilityByBranchId(branchId),
  ]);
  if (!experience) fail(409, 'STORE_EXPERIENCE_DRAFT_REQUIRED', 'à¸à¸£à¸¸à¸“à¸²à¸šà¸±à¸™à¸—à¸¶à¸à¹à¸šà¸šà¸£à¹ˆà¸²à¸‡à¸à¹ˆà¸­à¸™à¹€à¸œà¸¢à¹à¸žà¸£à¹ˆ');
  if (experience.status === 'SUSPENDED') fail(409, 'STORE_EXPERIENCE_NOT_EDITABLE', 'à¸«à¸™à¹‰à¸²à¸£à¹‰à¸²à¸™à¸–à¸¹à¸à¸£à¸°à¸‡à¸±à¸šà¹à¸¥à¸°à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¹€à¸œà¸¢à¹à¸žà¸£à¹ˆà¹„à¸”à¹‰');
  if (!capability) fail(409, 'PARTNER_STORE_CAPABILITY_REQUIRED', 'à¸à¸£à¸¸à¸“à¸²à¸šà¸±à¸™à¸—à¸¶à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸«à¸™à¹‰à¸²à¸£à¹‰à¸²à¸™à¸à¹ˆà¸­à¸™à¹€à¸œà¸¢à¹à¸žà¸£à¹ˆ');
  if (!String(capability.storefrontSlug || '').trim()) fail(400, 'STOREFRONT_SLUG_REQUIRED', 'à¸à¸£à¸¸à¸“à¸²à¸£à¸°à¸šà¸¸ URL à¸£à¹‰à¸²à¸™');
  if (!String(capability.displayName || '').trim()) fail(400, 'STOREFRONT_DISPLAY_NAME_REQUIRED', 'à¸à¸£à¸¸à¸“à¸²à¸£à¸°à¸šà¸¸à¸Šà¸·à¹ˆà¸­à¸—à¸µà¹ˆà¹à¸ªà¸”à¸‡');
  const sections = Array.isArray(experience.sectionConfiguration) ? experience.sectionConfiguration : [];
  if (!sections.some((section) => section?.enabled !== false)) {
    fail(400, 'STORE_EXPERIENCE_SECTION_REQUIRED', 'à¸•à¹‰à¸­à¸‡à¹€à¸›à¸´à¸”à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¸ªà¹ˆà¸§à¸™à¸›à¸£à¸°à¸à¸­à¸šà¸«à¸™à¹‰à¸²à¸£à¹‰à¸²à¸™à¸­à¸¢à¹ˆà¸²à¸‡à¸™à¹‰à¸­à¸¢à¸«à¸™à¸¶à¹ˆà¸‡à¸ªà¹ˆà¸§à¸™');
  }
  return repository.publishForBranch(branchId, {
    publishedThemePreset: experience.themePreset,
    publishedThemeTokens: experience.themeTokens,
    publishedLayoutPreset: experience.layoutPreset,
    publishedSectionConfiguration: experience.sectionConfiguration,
    publishedContentConfiguration: experience.contentConfiguration,
  });
};

const unpublishForBranch = async (branchId) => {
  const experience = await repository.findByBranchId(branchId);
  const capability = await repository.findCapabilityByBranchId(branchId);
  if (!experience || !capability) fail(404, 'STORE_EXPERIENCE_NOT_FOUND', 'à¹„à¸¡à¹ˆà¸žà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸«à¸™à¹‰à¸²à¸£à¹‰à¸²à¸™');
  if (!capability.storefrontEnabled) return { experience, capability };
  return repository.unpublishForBranch(branchId);
};

module.exports = {
  getDraftForBranch,
  saveDraftForBranch,
  publishForBranch,
  unpublishForBranch,
};
