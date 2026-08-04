'use strict';

const repository = require('./storeExperienceDraftRepository');

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
  if (!allowed.has(normalized)) fail(400, 'STORE_EXPERIENCE_VALIDATION_FAILED', `${field} ไม่ถูกต้อง`);
  return normalized;
};

const normalizeThemeTokens = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    fail(400, 'STORE_EXPERIENCE_VALIDATION_FAILED', 'themeTokens ต้องเป็น object');
  }
  const entries = Object.entries(value);
  if (entries.some(([key, color]) => !TOKEN_KEYS.has(key) || typeof color !== 'string' || !HEX_COLOR.test(color))) {
    fail(400, 'STORE_EXPERIENCE_VALIDATION_FAILED', 'themeTokens มี token หรือค่าสีที่ไม่รองรับ');
  }
  return Object.fromEntries(entries.map(([key, color]) => [key, color.toLowerCase()]));
};

const normalizeSections = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Array.isArray(value) || value.length > 12) {
    fail(400, 'STORE_EXPERIENCE_VALIDATION_FAILED', 'sectionConfiguration ต้องมี sections ไม่เกิน 12 รายการ');
  }
  const seen = new Set();
  return value.map((section, index) => {
    const id = String(section?.id || '').trim();
    const type = String(section?.type || '').trim().toUpperCase();
    if (!id || !/^[a-z0-9-]{1,80}$/i.test(id) || !SECTION_TYPES.has(type) || seen.has(id)) {
      fail(400, 'STORE_EXPERIENCE_VALIDATION_FAILED', `sectionConfiguration[${index}] ไม่ถูกต้อง`);
    }
    if (section.enabled !== undefined && typeof section.enabled !== 'boolean') {
      fail(400, 'STORE_EXPERIENCE_VALIDATION_FAILED', `sectionConfiguration[${index}].enabled ต้องเป็น boolean`);
    }
    seen.add(id);
    return { id, type, enabled: section.enabled !== false };
  });
};

const normalizeDraft = (payload = {}) => ({
  themePreset: normalizePreset(payload.themePreset, THEME_PRESETS, 'themePreset'),
  themeTokens: normalizeThemeTokens(payload.themeTokens),
  layoutPreset: normalizePreset(payload.layoutPreset, LAYOUT_PRESETS, 'layoutPreset'),
  sectionConfiguration: normalizeSections(payload.sectionConfiguration),
});

const defaults = (branchId) => ({
  branchId,
  status: 'DRAFT',
  themePreset: 'platform-default',
  themeTokens: null,
  layoutPreset: 'platform-default',
  sectionConfiguration: null,
  version: 1,
  publishedAt: null,
});

const getDraftForBranch = async (branchId) => {
  const existing = await repository.findByBranchId(branchId);
  return existing || defaults(branchId);
};

const saveDraftForBranch = async (branchId, payload) => {
  const existing = await repository.findByBranchId(branchId);
  if (existing && !['DRAFT', 'READY'].includes(existing.status)) {
    fail(409, 'STORE_EXPERIENCE_NOT_EDITABLE', 'กรุณายกเลิกเผยแพร่ก่อนแก้ไขแบบร่าง');
  }
  const normalized = Object.fromEntries(Object.entries(normalizeDraft(payload)).filter(([, value]) => value !== undefined));
  const current = existing || defaults(branchId);
  const next = { ...current, ...normalized };
  const update = { ...normalized, status: existing?.status || 'DRAFT', version: (existing?.version || 1) + 1, publishedAt: null };
  return repository.upsertDraftForBranch({
    branchId,
    create: { ...next, version: 1, publishedAt: null },
    update,
  });
};

const publishForBranch = async (branchId) => {
  const [experience, capability] = await Promise.all([
    repository.findByBranchId(branchId),
    repository.findCapabilityByBranchId(branchId),
  ]);
  if (!experience) fail(409, 'STORE_EXPERIENCE_DRAFT_REQUIRED', 'กรุณาบันทึกแบบร่างก่อนเผยแพร่');
  if (experience.status === 'SUSPENDED') fail(409, 'STORE_EXPERIENCE_SUSPENDED', 'หน้าร้านถูกระงับและไม่สามารถเผยแพร่ได้');
  if (!capability) fail(409, 'PARTNER_STORE_CAPABILITY_REQUIRED', 'กรุณาบันทึกข้อมูลหน้าร้านก่อนเผยแพร่');
  if (!String(capability.storefrontSlug || '').trim()) fail(400, 'STOREFRONT_SLUG_REQUIRED', 'กรุณาระบุ URL ร้าน');
  if (!String(capability.displayName || '').trim()) fail(400, 'STOREFRONT_DISPLAY_NAME_REQUIRED', 'กรุณาระบุชื่อที่แสดง');
  const sections = Array.isArray(experience.sectionConfiguration) ? experience.sectionConfiguration : [];
  if (!sections.some((section) => section?.enabled !== false)) {
    fail(400, 'STORE_EXPERIENCE_SECTION_REQUIRED', 'ต้องเปิดใช้งานส่วนประกอบหน้าร้านอย่างน้อยหนึ่งส่วน');
  }
  if (experience.status === 'PUBLISHED') return { experience, capability };
  return repository.publishForBranch(branchId);
};

const unpublishForBranch = async (branchId) => {
  const experience = await repository.findByBranchId(branchId);
  const capability = await repository.findCapabilityByBranchId(branchId);
  if (!experience || !capability) fail(404, 'STORE_EXPERIENCE_NOT_FOUND', 'ไม่พบข้อมูลหน้าร้าน');
  if (experience.status !== 'PUBLISHED') return { experience, capability };
  return repository.unpublishForBranch(branchId);
};

module.exports = {
  getDraftForBranch,
  saveDraftForBranch,
  publishForBranch,
  unpublishForBranch,
};
