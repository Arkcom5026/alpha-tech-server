const { prisma } = require('../../../../../lib/prisma');

const findProductById = (productId) =>
  prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      templateProductId: true,
      templateProduct: {
        select: {
          id: true,
          active: true,
        },
      },
    },
  });

const createProductImage = ({
  productId,
  uploadResult,
  url,
  publicId,
  secureUrl,
  caption,
  isCover,
}) => {
  const resolvedSecureUrl = uploadResult?.secure_url || secureUrl || url;
  const resolvedPublicId = uploadResult?.public_id || publicId;

  if (!resolvedSecureUrl || !resolvedPublicId) {
    throw new Error('PRODUCT_IMAGE_UPLOAD_RESULT_REQUIRED');
  }

  return prisma.$transaction(async (tx) => {
    if (isCover) {
      await tx.productImage.updateMany({ where: { productId }, data: { isCover: false } });
    }

    return tx.productImage.create({
      data: {
        productId,
        url: resolvedSecureUrl,
        public_id: resolvedPublicId,
        secure_url: resolvedSecureUrl,
        caption: caption || '',
        isCover,
      },
    });
  });
};

const findActiveProductImage = ({ productId, imageId }) =>
  prisma.productImage.findFirst({
    where: { id: imageId, productId, active: true },
    select: { id: true },
  });

const setCoverImage = ({ productId, imageId }) =>
  prisma.$transaction(async (tx) => {
    await tx.productImage.updateMany({ where: { productId }, data: { isCover: false } });
    await tx.productImage.update({ where: { id: imageId }, data: { isCover: true } });

    return tx.productImage.findMany({
      where: { productId, active: true },
      orderBy: [{ isCover: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, url: true, caption: true, isCover: true, public_id: true },
    });
  });

const findProductImage = ({ productId, imageId, publicId }) =>
  prisma.productImage.findFirst({
    where: {
      productId,
      ...(imageId ? { id: imageId } : {}),
      ...(!imageId && publicId ? { public_id: publicId } : {}),
    },
    select: { id: true, public_id: true, isCover: true, active: true },
  });

const softDeleteProductImage = ({ productId, image }) =>
  prisma.$transaction(async (tx) => {
    await tx.productImage.update({
      where: { id: image.id },
      data: { active: false, isCover: false },
    });

    if (image.isCover) {
      const nextCover = await tx.productImage.findFirst({
        where: { productId, active: true },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      if (nextCover) {
        await tx.productImage.update({ where: { id: nextCover.id }, data: { isCover: true } });
      }
    }

    return tx.productImage.findMany({
      where: { productId, active: true },
      orderBy: [{ isCover: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, url: true, caption: true, isCover: true, public_id: true },
    });
  });

module.exports = {
  findProductById,
  createProductImage,
  findActiveProductImage,
  setCoverImage,
  findProductImage,
  softDeleteProductImage,
};
