// src/modules/brand/controllers/brandController.js
// Brand Module Controller

const { prisma } = require('../../../../lib/prisma');
const { BrandService } = require('../services/brandService');

const service = new BrandService(prisma);

const sendError = (res, error, fallbackMessage, fallbackCode) => {
  const statusCode = error?.statusCode || error?.status || 500;

  if (statusCode >= 500) {
    console.error(`[brandController] ${fallbackCode}:`, error);
  }

  return res.status(statusCode).json({
    success: false,
    message: error?.message || fallbackMessage,
    code: error?.code || fallbackCode,
    error: error?.code || fallbackCode,
    ...(error?.conflict ? { conflict: error.conflict } : {}),
  });
};

const listProductTypeOptions = async (req, res) => {
  try {
    const payload = await service.listProductTypeOptions({
      query: req.query || {},
      user: req.user || {},
    });
    res.set('Cache-Control', 'no-store');
    return res.json(payload);
  } catch (error) {
    return sendError(res, error, 'ไม่สามารถโหลดประเภทสินค้าสำหรับจัดการแบรนด์ได้', 'BRAND_PRODUCT_TYPE_OPTIONS_FAILED');
  }
};

const listBrands = async (req, res) => {
  try {
    const payload = await service.listBrands({
      query: req.query || {},
      user: req.user || {},
    });
    res.set('Cache-Control', 'no-store');
    return res.json(payload);
  } catch (error) {
    return sendError(res, error, 'เกิดข้อผิดพลาดในการดึงข้อมูลแบรนด์', 'BRAND_LIST_FAILED');
  }
};

const listBrandDropdowns = async (req, res) => {
  try {
    const payload = await service.listDropdownBrands({
      query: req.query || {},
      user: req.user || {},
    });
    res.set('Cache-Control', 'no-store');
    return res.json(payload);
  } catch (error) {
    return sendError(res, error, 'เกิดข้อผิดพลาดในการดึงข้อมูลแบรนด์สำหรับ dropdown', 'BRAND_DROPDOWN_FAILED');
  }
};

const createBrand = async (req, res) => {
  try {
    const payload = await service.createBrand({ payload: req.body || {} });
    return res.status(201).json(payload);
  } catch (error) {
    return sendError(res, error, 'ไม่สามารถสร้างแบรนด์ได้', 'BRAND_CREATE_FAILED');
  }
};

const updateBrand = async (req, res) => {
  try {
    const payload = await service.updateBrand({
      id: req.params?.id,
      payload: req.body || {},
    });
    return res.json(payload);
  } catch (error) {
    return sendError(res, error, 'ไม่สามารถแก้ไขแบรนด์ได้', 'BRAND_UPDATE_FAILED');
  }
};

const toggleBrand = async (req, res) => {
  try {
    const payload = await service.toggleBrand({
      id: req.params?.id,
      payload: req.body || {},
    });
    return res.json(payload);
  } catch (error) {
    return sendError(res, error, 'ไม่สามารถเปลี่ยนสถานะแบรนด์ได้', 'BRAND_TOGGLE_FAILED');
  }
};

const listProductTypeBrands = async (req, res) => {
  try {
    const payload = await service.listProductTypeBrandLinks({
      query: req.query || {},
      user: req.user || {},
    });
    res.set('Cache-Control', 'no-store');
    return res.json(payload);
  } catch (error) {
    return sendError(res, error, 'ไม่สามารถโหลดแบรนด์ของประเภทสินค้าได้', 'PRODUCT_TYPE_BRAND_LIST_FAILED');
  }
};

const attachBrandToProductType = async (req, res) => {
  try {
    const payload = await service.attachBrandToProductType({
      payload: req.body || {},
      user: req.user || {},
    });
    return res.status(201).json({
      message: 'เพิ่ม mapping แบรนด์กับประเภทสินค้าสำเร็จ',
      data: payload,
    });
  } catch (error) {
    return sendError(res, error, 'ไม่สามารถเพิ่ม mapping แบรนด์กับประเภทสินค้าได้', 'PRODUCT_TYPE_BRAND_ATTACH_FAILED');
  }
};

const detachBrandFromProductType = async (req, res) => {
  try {
    const payload = await service.detachBrandFromProductType({
      id: req.params?.id,
      user: req.user || {},
    });
    return res.json({
      message: 'ลบ mapping แบรนด์กับประเภทสินค้าสำเร็จ',
      data: payload,
    });
  } catch (error) {
    return sendError(res, error, 'ไม่สามารถลบ mapping แบรนด์กับประเภทสินค้าได้', 'PRODUCT_TYPE_BRAND_DETACH_FAILED');
  }
};

module.exports = {
  listProductTypeOptions,
  listBrands,
  listBrandDropdowns,
  createBrand,
  updateBrand,
  toggleBrand,
  listProductTypeBrands,
  attachBrandToProductType,
  detachBrandFromProductType,
};
