// src/modules/productType/controllers/productTypeController.js
// ProductType Module Controller v3
//
// Runtime Rule:
// - This controller must not re-export legacy ProductType controller.
// - ProductType runtime flows through ProductTypeService only.
// - ProductType category truth is resolved through GlobalProductType, not ProductType.category.

const { prisma } = require('../../../../lib/prisma');
const { ProductTypeService } = require('../services/productTypeService');

const productTypeService = new ProductTypeService(prisma);

const sendError = (res, err, fallbackCode, fallbackMessage, logLabel) => {
  const status = err.statusCode || err.status || 500;
  const code = err.code || fallbackCode;

  if (status >= 500) {
    console.error(logLabel, err);
  }

  return res.status(status).json({
    error: code,
    code,
    message: err.message || fallbackMessage,
  });
};

const getAllProductType = async (req, res) => {
  try {
    const payload = await productTypeService.listBranchProductTypes({
      branchId: req.user?.branchId,
      query: req.query || {},
    });

    res.set('Cache-Control', 'no-store');
    return res.json(payload);
  } catch (err) {
    return sendError(
      res,
      err,
      'PRODUCT_TYPE_LIST_FAILED',
      'ไม่สามารถโหลดรายการประเภทสินค้าได้',
      '❌ GET ProductTypes Failed:'
    );
  }
};

const getProductTypeById = async (req, res) => {
  try {
    const payload = await productTypeService.getBranchProductTypeById({
      branchId: req.user?.branchId,
      id: req.params?.id,
    });

    res.set('Cache-Control', 'no-store');
    return res.json(payload);
  } catch (err) {
    return sendError(
      res,
      err,
      'PRODUCT_TYPE_GET_FAILED',
      'ไม่สามารถโหลดข้อมูลประเภทสินค้าได้',
      '❌ GET ProductType Failed:'
    );
  }
};

const getProductTypeDropdowns = async (req, res) => {
  try {
    const payload = await productTypeService.listDropdowns({
      branchId: req.user?.branchId,
      query: req.query || {},
    });

    res.set('Cache-Control', 'no-store');
    return res.json(payload);
  } catch (err) {
    return sendError(
      res,
      err,
      'PRODUCT_TYPE_DROPDOWNS_FAILED',
      'ไม่สามารถโหลดตัวเลือกประเภทสินค้าได้',
      '❌ GET ProductType dropdowns Failed:'
    );
  }
};

const getGlobalProductTypeOptions = async (req, res) => {
  try {
    const payload = await productTypeService.listGlobalOptions({
      branchId: req.user?.branchId,
      query: req.query || {},
    });

    res.set('Cache-Control', 'no-store');
    return res.json(payload);
  } catch (err) {
    return sendError(
      res,
      err,
      'GLOBAL_PRODUCT_TYPE_OPTIONS_FAILED',
      'ไม่สามารถโหลดประเภทสินค้ากลางอ้างอิงได้',
      '❌ GET GlobalProductType options Failed:'
    );
  }
};

const getTemplateProductTypeOptions = async (req, res) => {
  try {
    const payload = await productTypeService.listTemplateOptions({
      branchId: req.user?.branchId,
      templateBranchCode: req.query?.templateBranchCode,
      templateBranchId: req.query?.templateBranchId,
      includeInactive: req.query?.includeInactive === 'true',
    });

    res.set('Cache-Control', 'no-store');
    return res.json(payload);
  } catch (err) {
    return sendError(
      res,
      err,
      'PRODUCT_TYPE_TEMPLATE_OPTIONS_FAILED',
      'ไม่สามารถโหลดประเภทสินค้าจากสาขาต้นแบบได้',
      '❌ GET ProductType template-options Failed:'
    );
  }
};

const createProductType = async (req, res) => {
  try {
    const payload = await productTypeService.createBranchProductType({
      branchId: req.user?.branchId,
      payload: req.body || {},
    });

    return res.status(201).json(payload);
  } catch (err) {
    return sendError(
      res,
      err,
      'PRODUCT_TYPE_CREATE_FAILED',
      'ไม่สามารถสร้างประเภทสินค้าได้',
      '❌ CREATE ProductType Failed:'
    );
  }
};

const updateProductType = async (req, res) => {
  try {
    const payload = await productTypeService.updateBranchProductType({
      branchId: req.user?.branchId,
      id: req.params?.id,
      payload: req.body || {},
    });

    return res.json(payload);
  } catch (err) {
    return sendError(
      res,
      err,
      'PRODUCT_TYPE_UPDATE_FAILED',
      'ไม่สามารถแก้ไขประเภทสินค้าได้',
      '❌ UPDATE ProductType Failed:'
    );
  }
};

const archiveProductType = async (req, res) => {
  try {
    const payload = await productTypeService.setActive({
      branchId: req.user?.branchId,
      id: req.params?.id,
      active: false,
    });

    return res.json(payload);
  } catch (err) {
    return sendError(
      res,
      err,
      'PRODUCT_TYPE_ARCHIVE_FAILED',
      'ไม่สามารถปิดใช้งานประเภทสินค้าได้',
      '❌ ARCHIVE ProductType Failed:'
    );
  }
};

const restoreProductType = async (req, res) => {
  try {
    const payload = await productTypeService.setActive({
      branchId: req.user?.branchId,
      id: req.params?.id,
      active: true,
    });

    return res.json(payload);
  } catch (err) {
    return sendError(
      res,
      err,
      'PRODUCT_TYPE_RESTORE_FAILED',
      'ไม่สามารถกู้คืนประเภทสินค้าได้',
      '❌ RESTORE ProductType Failed:'
    );
  }
};

module.exports = {
  getAllProductType,
  getProductTypeById,
  createProductType,
  updateProductType,
  archiveProductType,
  restoreProductType,
  getProductTypeDropdowns,
  getGlobalProductTypeOptions,
  getTemplateProductTypeOptions,
};
