// controllers/productTypeBrandController.js — Prisma singleton, validations, safer Prisma errors

const { prisma, Prisma } = require('../lib/prisma');

const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));
const omitUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

// POST /product-type-brands
const attachBrandToProductType = async (req, res) => {
  try {
    const productTypeId = toInt(req.body?.productTypeId);
    const brandId = toInt(req.body?.brandId);

    if (!productTypeId || !brandId) {
      return res.status(400).json({
        message: 'กรุณาระบุ productTypeId และ brandId ให้ถูกต้อง',
        code: 'INVALID_PRODUCTTYPE_OR_BRAND',
      });
    }

    const [productType, brand] = await Promise.all([
      prisma.productType.findUnique({
        where: { id: productTypeId },
        select: { id: true, name: true },
      }),
      prisma.brand.findUnique({
        where: { id: brandId },
        select: { id: true, name: true, active: true },
      }),
    ]);

    if (!productType) {
      return res.status(404).json({
        message: 'ไม่พบประเภทสินค้า',
        code: 'PRODUCT_TYPE_NOT_FOUND',
      });
    }

    if (!brand) {
      return res.status(404).json({
        message: 'ไม่พบแบรนด์',
        code: 'BRAND_NOT_FOUND',
      });
    }

    const existing = await prisma.productTypeBrand.findUnique({
      where: {
        productTypeId_brandId: {
          productTypeId,
          brandId,
        },
      },
      select: {
        id: true,
        productTypeId: true,
        brandId: true,
      },
    });

    if (existing) {
      return res.status(200).json({
        message: 'แบรนด์นี้ถูกผูกกับประเภทสินค้าไว้แล้ว',
        data: existing,
      });
    }

    const created = await prisma.productTypeBrand.create({
      data: omitUndefined({
        productTypeId,
        brandId,
      }),
      select: {
        id: true,
        productTypeId: true,
        brandId: true,
      },
    });

    return res.status(201).json({
      message: 'เพิ่ม mapping แบรนด์กับประเภทสินค้าสำเร็จ',
      data: created,
    });
  } catch (err) {
    console.error('❌ [attachBrandToProductType] error:', err);

    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(200).json({
        message: 'แบรนด์นี้ถูกผูกกับประเภทสินค้าไว้แล้ว',
        code: 'PRODUCT_TYPE_BRAND_ALREADY_EXISTS',
      });
    }

    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      return res.status(409).json({
        message: 'ไม่สามารถผูก mapping ได้ เนื่องจากมีการอ้างอิงไม่ถูกต้อง',
        code: 'PRODUCT_TYPE_BRAND_FOREIGN_KEY_CONSTRAINT',
      });
    }

    return res.status(500).json({
      error: 'ไม่สามารถเพิ่ม mapping แบรนด์กับประเภทสินค้าได้',
      code: 'ATTACH_BRAND_TO_PRODUCT_TYPE_FAILED',
    });
  }
};

module.exports = {
  attachBrandToProductType,
};



