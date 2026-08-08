'use strict';

const crypto = require('crypto');
const streamifier = require('streamifier');
const { cloudinary } = require('../../../../utils/cloudinary');
const mediaRepository = require('./storefrontMediaRepository');

const PURPOSES = Object.freeze({
  STORE_LOGO: 'logo',
  STORE_COVER: 'cover',
  STORE_HERO: 'hero',
  STORE_PROMOTION: 'promotion',
});

const PURPOSE_CONTENT_FIELDS = Object.freeze({
  STORE_LOGO: 'logoUrl',
  STORE_COVER: 'coverImageUrl',
  STORE_HERO: 'heroImageUrl',
  STORE_PROMOTION: 'promotionImageUrl',
});

const DEFAULT_LIBRARY_PAGE_SIZE = 24;
const MAX_LIBRARY_PAGE_SIZE = 60;

const makeError = (code, message, statusCode = 400, cause = null) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  if (cause) error.cause = cause;
  return error;
};

const normalizePurpose = (value) => String(value || '').trim().toUpperCase();
const normalizeSearch = (value) => String(value || '').trim().toLowerCase().slice(0, 120);
const normalizePageSize = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_LIBRARY_PAGE_SIZE;
  return Math.min(parsed, MAX_LIBRARY_PAGE_SIZE);
};

const purposeFromPublicId = (publicId, branchId) => {
  const prefix = `stores/branch-${branchId}/`;
  const relative = String(publicId || '').startsWith(prefix)
    ? String(publicId).slice(prefix.length)
    : '';
  const folder = relative.split('/')[0];
  return Object.entries(PURPOSES).find(([, value]) => value === folder)?.[0] || null;
};

const normalizeLibraryAsset = (resource, branchId) => ({
  provider: 'cloudinary',
  branchId,
  purpose: purposeFromPublicId(resource?.public_id, branchId),
  secureUrl: resource?.secure_url || null,
  publicId: resource?.public_id || null,
  width: resource?.width ?? null,
  height: resource?.height ?? null,
  bytes: resource?.bytes ?? null,
  format: resource?.format ?? null,
  resourceType: resource?.resource_type ?? 'image',
  createdAt: resource?.created_at ?? null,
});

const usageStateOf = ({ draft, published }) => {
  if (draft && published) return 'DRAFT_AND_PUBLISHED';
  if (draft) return 'DRAFT';
  if (published) return 'PUBLISHED';
  return 'UNUSED';
};

const classifyUsage = (asset, experience) => {
  const field = PURPOSE_CONTENT_FIELDS[asset?.purpose];
  const draftUrl = field ? experience?.contentConfiguration?.[field] : null;
  const publishedUrl = field ? experience?.publishedContentConfiguration?.[field] : null;
  const draft = Boolean(asset?.secureUrl && draftUrl === asset.secureUrl);
  const published = Boolean(asset?.secureUrl && publishedUrl === asset.secureUrl);

  return {
    ...asset,
    usage: {
      draft,
      published,
      state: usageStateOf({ draft, published }),
    },
    deletable: false,
  };
};

const matchesSearch = (asset, search) => {
  if (!search) return true;
  return [asset?.publicId, asset?.secureUrl, asset?.format, asset?.purpose]
    .some((value) => String(value || '').toLowerCase().includes(search));
};

const createStorefrontMediaService = ({
  cloudinaryClient = cloudinary,
  repository = mediaRepository,
  idFactory = () => crypto.randomUUID(),
} = {}) => {
  const requireBranch = (branchId) => {
    const normalizedBranchId = Number(branchId);
    if (!Number.isInteger(normalizedBranchId) || normalizedBranchId <= 0) {
      throw makeError('EMPLOYEE_BRANCH_CONTEXT_REQUIRED', 'ไม่พบร้านของผู้ดำเนินการ', 403);
    }
    return normalizedBranchId;
  };

  const upload = async ({ branchId, purpose, file } = {}) => {
    const normalizedBranchId = requireBranch(branchId);
    const normalizedPurpose = normalizePurpose(purpose);
    const purposeFolder = PURPOSES[normalizedPurpose];

    if (!purposeFolder) {
      throw makeError('INVALID_STOREFRONT_MEDIA_PURPOSE', 'วัตถุประสงค์ของรูปภาพไม่ถูกต้อง');
    }
    if (!file?.buffer || !file?.mimetype?.startsWith('image/')) {
      throw makeError('STOREFRONT_MEDIA_IMAGE_REQUIRED', 'กรุณาเลือกรูปภาพ');
    }

    const folder = `stores/branch-${normalizedBranchId}/${purposeFolder}`;
    const assetId = idFactory();

    let uploaded;
    try {
      uploaded = await new Promise((resolve, reject) => {
        const stream = cloudinaryClient.uploader.upload_stream({
          folder,
          public_id: assetId,
          resource_type: 'image',
          overwrite: false,
          unique_filename: false,
        }, (error, result) => {
          if (error) return reject(error);
          return resolve(result);
        });
        streamifier.createReadStream(file.buffer).pipe(stream);
      });
    } catch (error) {
      throw makeError(
        'STOREFRONT_MEDIA_PROVIDER_UPLOAD_FAILED',
        'ผู้ให้บริการจัดเก็บรูปภาพไม่สามารถรับไฟล์ได้',
        502,
        error
      );
    }

    if (!uploaded?.secure_url || !uploaded?.public_id) {
      throw makeError(
        'STOREFRONT_MEDIA_PROVIDER_RESPONSE_INVALID',
        'ผู้ให้บริการจัดเก็บรูปภาพตอบกลับไม่สมบูรณ์',
        502
      );
    }

    return {
      provider: 'cloudinary',
      purpose: normalizedPurpose,
      branchId: normalizedBranchId,
      secureUrl: uploaded.secure_url,
      publicId: uploaded.public_id,
      width: uploaded.width ?? null,
      height: uploaded.height ?? null,
      bytes: uploaded.bytes ?? file.size ?? file.buffer.length,
      format: uploaded.format ?? null,
      resourceType: uploaded.resource_type ?? 'image',
    };
  };

  const list = async ({ branchId, purpose, search, pageSize, nextCursor } = {}) => {
    const normalizedBranchId = requireBranch(branchId);
    const normalizedPurpose = purpose ? normalizePurpose(purpose) : null;
    const normalizedSearch = normalizeSearch(search);
    const purposeFolder = normalizedPurpose ? PURPOSES[normalizedPurpose] : null;

    if (normalizedPurpose && !purposeFolder) {
      throw makeError('INVALID_STOREFRONT_MEDIA_PURPOSE', 'วัตถุประสงค์ของรูปภาพไม่ถูกต้อง');
    }

    const prefix = purposeFolder
      ? `stores/branch-${normalizedBranchId}/${purposeFolder}/`
      : `stores/branch-${normalizedBranchId}/`;

    const options = {
      resource_type: 'image',
      type: 'upload',
      prefix,
      max_results: normalizePageSize(pageSize),
      direction: 'desc',
    };
    if (nextCursor) options.next_cursor = String(nextCursor);

    let response;
    try {
      response = await cloudinaryClient.api.resources(options);
    } catch (error) {
      throw makeError(
        'STOREFRONT_MEDIA_PROVIDER_LIST_FAILED',
        'ไม่สามารถโหลดคลังรูปภาพจากผู้ให้บริการได้',
        502,
        error
      );
    }

    let experience;
    try {
      experience = await repository.findExperienceUsageByBranchId(normalizedBranchId);
    } catch (error) {
      throw makeError(
        'STOREFRONT_MEDIA_USAGE_LOOKUP_FAILED',
        'ไม่สามารถตรวจสอบการใช้งานรูปภาพได้',
        500,
        error
      );
    }

    const assets = Array.isArray(response?.resources)
      ? response.resources
        .map((resource) => normalizeLibraryAsset(resource, normalizedBranchId))
        .filter((asset) => asset.secureUrl && asset.publicId && asset.purpose)
        .filter((asset) => matchesSearch(asset, normalizedSearch))
        .map((asset) => classifyUsage(asset, experience))
      : [];

    return {
      branchId: normalizedBranchId,
      purpose: normalizedPurpose,
      search: normalizedSearch || null,
      assets,
      nextCursor: response?.next_cursor || null,
    };
  };

  return { upload, list };
};

module.exports = {
  PURPOSES,
  PURPOSE_CONTENT_FIELDS,
  DEFAULT_LIBRARY_PAGE_SIZE,
  MAX_LIBRARY_PAGE_SIZE,
  normalizePurpose,
  normalizeSearch,
  normalizePageSize,
  purposeFromPublicId,
  normalizeLibraryAsset,
  usageStateOf,
  classifyUsage,
  matchesSearch,
  createStorefrontMediaService,
  storefrontMediaService: createStorefrontMediaService(),
};
