'use strict';

const crypto = require('crypto');
const streamifier = require('streamifier');
const { cloudinary } = require('../../../../utils/cloudinary');

const PURPOSES = Object.freeze({
  STORE_LOGO: 'logo',
  STORE_COVER: 'cover',
  STORE_HERO: 'hero',
  STORE_PROMOTION: 'promotion',
});

const makeError = (code, message, statusCode = 400, cause = null) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  if (cause) error.cause = cause;
  return error;
};

const normalizePurpose = (value) => String(value || '').trim().toUpperCase();

const createStorefrontMediaService = ({
  cloudinaryClient = cloudinary,
  idFactory = () => crypto.randomUUID(),
} = {}) => {
  const upload = async ({ branchId, purpose, file } = {}) => {
    const normalizedBranchId = Number(branchId);
    const normalizedPurpose = normalizePurpose(purpose);
    const purposeFolder = PURPOSES[normalizedPurpose];

    if (!Number.isInteger(normalizedBranchId) || normalizedBranchId <= 0) {
      throw makeError('EMPLOYEE_BRANCH_CONTEXT_REQUIRED', 'ไม่พบร้านของผู้ดำเนินการ', 403);
    }
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

  return { upload };
};

module.exports = {
  PURPOSES,
  normalizePurpose,
  createStorefrontMediaService,
  storefrontMediaService: createStorefrontMediaService(),
};
