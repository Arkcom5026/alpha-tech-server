const { searchSaleItems } = require('../services/saleItemSearchService');

const searchSaleItemsController = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    const query = String(req.query?.query || '').trim();
    const result = await searchSaleItems({ branchId, query });

    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Surrogate-Control': 'no-store',
    });

    return res.json({
      ...result,
      message: result.items.length ? null : 'ไม่พบสินค้าที่พร้อมขายจากข้อมูลค้นหานี้',
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) {
      console.error('[sales.item-search] failed', {
        code: error?.code,
        message: error?.message,
      });
    }

    return res.status(status).json({
      code: error?.code || 'SALE_ITEM_SEARCH_FAILED',
      message: error?.message || 'ไม่สามารถค้นหาสินค้าสำหรับขายได้',
      ...(error?.details ? { details: error.details } : {}),
    });
  }
};

module.exports = { searchSaleItemsController };
