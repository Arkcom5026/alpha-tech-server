// src/modules/productType/controllers/productTypeController.js
// ProductType Module Controller v2
//
// No legacy controller spread.
// This module owns ProductType runtime/list/create/update/archive/restore by itself.

const { prisma } = require('../../../../lib/prisma');
const { ProductTypeService } = require('../services/productTypeService');

const service = new ProductTypeService(prisma);

const sendError = (res, error, fallbackMessage, fallbackCode) => {
  const statusCode = error?.statusCode || error?.status || 500;
  if (statusCode >= 500) {
    console.error(`[productTypeController] ${fallbackCode}:`, error);
  }

  return res.status(statusCode).json({
    success: false,
    message: error?.message || fallbackMessage,
    code: error?.code || fallbackCode,
    error: error?.code || fallbackCode,
    ...(error?.conflict ? { conflict: error.conflict } : {}),
  });
};

const getAllProductType = async (req, res) => {
  try {
    const payload = await service.listBranchProductTypes({
      branchId: req.user?.branchId,
      query: req.query || {},
    });

    res.set('Cache-Control', 'no-store');
    return res.status(200).json(payload);
  } catch (error) {
    return sendError(
      res,
      error,
      'ไม่สามารถโหลดประเภทสินค้าของสาขาได้',
      'PRODUCT_TYPE_LIST_FAILED'
    );
  }
};

const getProductTypeDropdowns = async (req, res) => {
  try {
    const payload = await service.listDropdowns({
      branchId: req.user?.branchId,
      query: req.query || {},
    });

    res.set('Cache-Control', 'no-store');
    return res.status(200).json(payload);
  } catch (error) {
    return sendError(
      res,
      error,
      'ไม่สามารถโหลด dropdown ประเภทสินค้าได้',
      'PRODUCT_TYPE_DROPDOWNS_FAILED'
    );
  }
};

const getProductTypeById = async (req, res) => {
  try {
    const payload = await service.getBranchProductTypeById({
      branchId: req.user?.branchId,
      id: req.params?.id,
    });

    res.set('Cache-Control', 'no-store');
    return res.status(200).json(payload);
  } catch (error) {
    return sendError(
      res,
      error,
      'ไม่สามารถโหลดประเภทสินค้านี้ได้',
      'PRODUCT_TYPE_GET_FAILED'
    );
  }
};

const getTemplateProductTypeOptions = async (req, res) => {
  try {
    const payload = await service.listTemplateOptions({
      branchId: req.user?.branchId,
      templateBranchCode: req.query?.templateBranchCode,
      templateBranchId: req.query?.templateBranchId,
      includeInactive: req.query?.includeInactive === 'true',
    });

    res.set('Cache-Control', 'no-store');
    return res.status(200).json(payload);
  } catch (error) {
    return sendError(
      res,
      error,
      'ไม่สามารถโหลดประเภทสินค้าจากสาขาต้นแบบได้',
      'PRODUCT_TYPE_TEMPLATE_OPTIONS_FAILED'
    );
  }
};

const createProductType = async (req, res) => {
  try {
    const created = await service.createBranchProductType({
      branchId: req.user?.branchId,
      payload: req.body || {},
    });

    return res.status(201).json(created);
  } catch (error) {
    return sendError(
      res,
      error,
      'ไม่สามารถเพิ่มประเภทสินค้าได้',
      'PRODUCT_TYPE_CREATE_FAILED'
    );
  }
};

const updateProductType = async (req, res) => {
  try {
    const updated = await service.updateBranchProductType({
      branchId: req.user?.branchId,
      id: req.params?.id,
      payload: req.body || {},
    });

    return res.status(200).json(updated);
  } catch (error) {
    return sendError(
      res,
      error,
      'ไม่สามารถแก้ไขประเภทสินค้าได้',
      'PRODUCT_TYPE_UPDATE_FAILED'
    );
  }
};

const archiveProductType = async (req, res) => {
  try {
    const updated = await service.setActive({
      branchId: req.user?.branchId,
      id: req.params?.id,
      active: false,
    });

    return res.status(200).json(updated);
  } catch (error) {
    return sendError(
      res,
      error,
      'ไม่สามารถปิดใช้งานประเภทสินค้าได้',
      'PRODUCT_TYPE_ARCHIVE_FAILED'
    );
  }
};

const restoreProductType = async (req, res) => {
  try {
    const updated = await service.setActive({
      branchId: req.user?.branchId,
      id: req.params?.id,
      active: true,
    });

    return res.status(200).json(updated);
  } catch (error) {
    return sendError(
      res,
      error,
      'ไม่สามารถเปิดใช้งานประเภทสินค้าได้',
      'PRODUCT_TYPE_RESTORE_FAILED'
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
  getTemplateProductTypeOptions,
};
