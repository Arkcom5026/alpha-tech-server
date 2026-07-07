// src/modules/product/productType/controllers/productTypeController.js
const legacyProductTypeController = require('../../../../controllers/productTypeController');
const { prisma } = require('../../../../lib/prisma');
const { ProductTypeService } = require('../services/productTypeService');

const productTypeService = new ProductTypeService(prisma);


const getGlobalProductTypeOptions = async (req, res) => {
  try {
    const payload = await productTypeService.listGlobalOptions({
      branchId: req.user?.branchId,
      query: req.query || {},
    });

    res.set('Cache-Control', 'no-store');
    return res.json(payload);
  } catch (err) {
    const status = err.statusCode || err.status || 500;
    const code = err.code || 'GLOBAL_PRODUCT_TYPE_OPTIONS_FAILED';

    if (status >= 500) {
      console.error('❌ GET GlobalProductType options Failed:', err);
    }

    return res.status(status).json({
      error: code,
      message: err.message || 'ไม่สามารถโหลดประเภทสินค้ากลางอ้างอิงได้',
    });
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
    const status = err.statusCode || err.status || 500;
    const code = err.code || 'PRODUCT_TYPE_TEMPLATE_OPTIONS_FAILED';

    if (status >= 500) {
      console.error('❌ GET ProductType template-options Failed:', err);
    }

    return res.status(status).json({
      error: code,
      message: err.message || 'ไม่สามารถโหลดประเภทสินค้าจากสาขาต้นแบบได้',
    });
  }
};

module.exports = {
  ...legacyProductTypeController,
  getGlobalProductTypeOptions,
  getTemplateProductTypeOptions,
};
