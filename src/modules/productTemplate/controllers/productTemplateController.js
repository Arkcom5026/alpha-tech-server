// src/modules/productTemplate/controllers/productTemplateController.js
// Mission C — Template Catalog Controller

const { prisma } = require('../../../../lib/prisma');
const { ProductTemplateService } = require('../services/productTemplateService');
const { getClonePreview } = require('../services/templateClonePreviewService');

const service = new ProductTemplateService(prisma);

const sendError = (res, error, fallbackMessage, fallbackCode) => {
  console.error(`[productTemplateController] ${fallbackCode}:`, error);
  const statusCode = error?.statusCode || error?.status || 500;
  return res.status(statusCode).json({
    success: false,
    message: error?.message || fallbackMessage,
    code: error?.code || fallbackCode,
  });
};

const getAllProductTemplates = async (req, res) => {
  try {
    const result = await service.listTemplates(req.query || {});
    return res.status(200).json({ success: true, ...result, data: result.items });
  } catch (error) {
    return sendError(res, error, 'ไม่สามารถโหลด Product Templates ได้', 'PRODUCT_TEMPLATE_LIST_FAILED');
  }
};

const getProductTemplateById = async (req, res) => {
  try {
    const template = await service.getTemplateById(req.params.id, req.query || {});
    return res.status(200).json({ success: true, data: template, item: template });
  } catch (error) {
    return sendError(res, error, 'ไม่สามารถโหลด Product Template ได้', 'PRODUCT_TEMPLATE_DETAIL_FAILED');
  }
};

const previewTemplateClone = async (req, res) => {
  try {
    const preview = await getClonePreview(prisma, {
      templateProductId: req.params.id,
      targetBranchId: req.query.targetBranchId || req.body?.targetBranchId,
      templateBranchCode: req.query.templateBranchCode || req.body?.templateBranchCode,
    });
    return res.status(200).json({ success: true, data: preview, item: preview });
  } catch (error) {
    return sendError(res, error, 'ไม่สามารถ Preview การ Clone Template ได้', 'PRODUCT_TEMPLATE_CLONE_PREVIEW_FAILED');
  }
};

const createProductTemplate = async (req, res) => {
  try {
    const template = await service.createTemplate(req.body || {}, req.query || {});
    return res.status(201).json({ success: true, data: template, item: template });
  } catch (error) {
    return sendError(res, error, 'ไม่สามารถสร้าง Product Template ได้', 'PRODUCT_TEMPLATE_CREATE_FAILED');
  }
};

const updateProductTemplate = async (req, res) => {
  try {
    const template = await service.updateTemplate(req.params.id, req.body || {}, req.query || {});
    return res.status(200).json({ success: true, data: template, item: template });
  } catch (error) {
    return sendError(res, error, 'ไม่สามารถอัปเดต Product Template ได้', 'PRODUCT_TEMPLATE_UPDATE_FAILED');
  }
};

const archiveProductTemplate = async (req, res) => {
  try {
    const template = await service.setActive(req.params.id, false, req.query || {});
    return res.status(200).json({ success: true, data: template, item: template });
  } catch (error) {
    return sendError(res, error, 'ไม่สามารถปิดใช้งาน Product Template ได้', 'PRODUCT_TEMPLATE_ARCHIVE_FAILED');
  }
};

const restoreProductTemplate = async (req, res) => {
  try {
    const template = await service.setActive(req.params.id, true, req.query || {});
    return res.status(200).json({ success: true, data: template, item: template });
  } catch (error) {
    return sendError(res, error, 'ไม่สามารถเปิดใช้งาน Product Template ได้', 'PRODUCT_TEMPLATE_RESTORE_FAILED');
  }
};

const toggleProductTemplateActive = async (req, res) => {
  try {
    const current = await service.getTemplateById(req.params.id, req.query || {});
    const template = await service.setActive(req.params.id, !current.active, req.query || {});
    return res.status(200).json({ success: true, data: template, item: template });
  } catch (error) {
    return sendError(res, error, 'ไม่สามารถเปลี่ยนสถานะ Product Template ได้', 'PRODUCT_TEMPLATE_TOGGLE_FAILED');
  }
};

module.exports = {
  getAllProductTemplates,
  getProductTemplateById,
  previewTemplateClone,
  createProductTemplate,
  updateProductTemplate,
  archiveProductTemplate,
  restoreProductTemplate,
  toggleProductTemplateActive,
};
