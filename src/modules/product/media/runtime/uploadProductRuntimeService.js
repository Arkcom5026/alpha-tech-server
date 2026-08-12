const { v4: uuidv4 } = require('uuid');
const streamifier = require('streamifier');
const { cloudinary } = require('../../../../../utils/cloudinary');
const repository = require('./uploadProductRuntimeRepository');

const toInt = (value) => (
  value === undefined || value === null || value === ''
    ? undefined
    : Number(value)
);

const toBool = (value) => {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'y'].includes(normalized);
};

const normalizeCaptions = (body = {}) => {
  if (Array.isArray(body.captions)) return body.captions;
  if (typeof body.captions === 'string') return [body.captions];
  if (typeof body.caption === 'string') return [body.caption];
  return [];
};

const uploadBufferToCloudinary = async (file) => {
  const folder = 'products';
  const uniqueName = uuidv4();
  const publicId = `${folder}/${uniqueName}`;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        folder,
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );

    streamifier.createReadStream(file.buffer).pipe(stream);
  });
};

const uploadProductImagesOnly = async ({ files, body = {} }) => {
  if (!files || files.length === 0) {
    return {
      status: 400,
      body: { message: 'ไม่พบไฟล์ภาพที่อัปโหลด' },
    };
  }

  const captionsArray = normalizeCaptions(body);
  const coverIndex = toInt(body.coverIndex);

  const images = await Promise.all(
    files.map(async (file, index) => {
      const uploaded = await uploadBufferToCloudinary(file);
      return {
        url: uploaded.secure_url,
        public_id: uploaded.public_id,
        secure_url: uploaded.secure_url,
        caption: captionsArray[index] || '',
        isCover: index === coverIndex,
      };
    })
  );

  return {
    status: 200,
    body: {
      message: 'อัปโหลดภาพสำเร็จ',
      images,
    },
  };
};

const syncUploadedImageToTemplate = async ({
  product,
  normalizedFile,
  caption,
  isCover,
}) => {
  if (!product?.templateProductId || !product?.templateProduct?.active) {
    return {
      status: 'SKIPPED',
      templateProductId: product?.templateProductId || null,
      reason: 'TEMPLATE_PRODUCT_NOT_AVAILABLE',
    };
  }

  let templateUpload = null;
  try {
    templateUpload = await uploadBufferToCloudinary(normalizedFile);
    const templateImage = await repository.createProductImage({
      productId: Number(product.templateProductId),
      uploadResult: templateUpload,
      caption,
      isCover,
    });

    return {
      status: 'SYNCED',
      templateProductId: Number(product.templateProductId),
      templateImageId: templateImage.id,
      publicId: templateImage.public_id,
    };
  } catch (error) {
    if (templateUpload?.public_id) {
      try {
        await cloudinary.uploader.destroy(templateUpload.public_id, { resource_type: 'image' });
      } catch (_) {}
    }

    return {
      status: 'FAILED',
      templateProductId: Number(product.templateProductId) || null,
      reason: error?.code || error?.message || 'TEMPLATE_IMAGE_SYNC_FAILED',
    };
  }
};

const uploadAndSaveProductImages = async ({ productId, file, files, body = {} }) => {
  const normalizedProductId = toInt(productId);
  const normalizedFile = file ?? (Array.isArray(files) && files[0] ? files[0] : undefined);

  if (!normalizedFile || !normalizedProductId) {
    return {
      status: 400,
      body: {
        message:
          'ไม่พบ productId หรือไฟล์ภาพไม่ถูกต้อง (upload-full ต้องส่ง field = "file" แบบ multer.single หรือส่งเป็น "files" แล้วระบบจะหยิบไฟล์แรกให้)',
      },
    };
  }

  const product = await repository.findProductById(normalizedProductId);
  if (!product) {
    return { status: 404, body: { message: 'ไม่พบสินค้า' } };
  }

  const captionsArray = normalizeCaptions(body);
  const coverIndex = toInt(body.coverIndex);
  const uploaded = await uploadBufferToCloudinary(normalizedFile);

  const image = await repository.createProductImage({
    productId: normalizedProductId,
    uploadResult: uploaded,
    caption: captionsArray[0] || '',
    isCover: coverIndex === 0,
  });

  const templateImageSync = toBool(body.syncTemplateImage)
    ? await syncUploadedImageToTemplate({
        product,
        normalizedFile,
        caption: image.caption || captionsArray[0] || '',
        isCover: image.isCover === true,
      })
    : {
        status: 'SKIPPED',
        templateProductId: product.templateProductId || null,
        reason: 'SYNC_NOT_REQUESTED',
      };

  return {
    status: 200,
    body: {
      message: 'อัปโหลดและบันทึกภาพสำเร็จ',
      images: [image],
      templateImageSync,
    },
  };
};

const setProductCoverImage = async ({ productId, imageId }) => {
  const normalizedProductId = toInt(productId);
  const normalizedImageId = toInt(imageId);

  if (!normalizedProductId || !normalizedImageId) {
    return { status: 400, body: { message: 'Missing productId or imageId' } };
  }

  const product = await repository.findProductById(normalizedProductId);
  if (!product) {
    return { status: 404, body: { message: 'ไม่พบสินค้า' } };
  }

  const image = await repository.findActiveProductImage({
    productId: normalizedProductId,
    imageId: normalizedImageId,
  });

  if (!image) {
    return { status: 404, body: { message: 'ไม่พบรูปภาพของสินค้านี้' } };
  }

  const images = await repository.setCoverImage({
    productId: normalizedProductId,
    imageId: normalizedImageId,
  });

  return {
    status: 200,
    body: { message: 'ตั้งรูปหน้าปกสำเร็จ', images },
  };
};

const deleteProductImage = async ({ productId, imageId, publicId }) => {
  const normalizedProductId = toInt(productId);
  const normalizedImageId = toInt(imageId);

  if (!normalizedProductId) {
    return { status: 400, body: { message: 'ไม่พบ productId' } };
  }

  const image = await repository.findProductImage({
    productId: normalizedProductId,
    imageId: normalizedImageId,
    publicId,
  });

  if (!image) {
    return { status: 404, body: { message: 'ไม่พบรูปภาพ' } };
  }

  if (image.public_id) {
    try {
      await cloudinary.uploader.destroy(image.public_id, { resource_type: 'image' });
    } catch (error) {
      console.warn('⚠️ cloudinary destroy failed:', error?.message || error);
    }
  }

  const images = await repository.softDeleteProductImage({
    productId: normalizedProductId,
    image,
  });

  return {
    status: 200,
    body: { message: 'ลบรูปภาพสำเร็จ', images },
  };
};

module.exports = {
  uploadProductImagesOnly,
  uploadAndSaveProductImages,
  syncUploadedImageToTemplate,
  setProductCoverImage,
  deleteProductImage,
};
