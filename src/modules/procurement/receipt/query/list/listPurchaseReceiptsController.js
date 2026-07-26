const listPurchaseReceiptsService = require('./listPurchaseReceiptsService');

class ListPurchaseReceiptsController {
  constructor(service = listPurchaseReceiptsService) {
    this.service = service;
    this.handle = this.handle.bind(this);
  }

  async handle(req, res) {
    try {
      res.set(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate'
      );
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.set('ETag', `W/"${Date.now()}"`);

      const branchId = Number(req.user?.branchId);
      if (!branchId) {
        return res.status(401).json({ error: 'unauthorized' });
      }

      const result = await this.service.execute(branchId, req.query);

      if (process.env.NODE_ENV !== 'production') {
        console.log('[listPurchaseReceipts] filters:', {
          printedFilter: result.filters.printed,
          qRaw: result.filters.q,
          supplierRaw: result.filters.supplier,
          supplierId: result.filters.supplierId,
          count: result.items.length,
        });
      }

      return res.json(result.items);
    } catch (error) {
      console.error('❌ [listPurchaseReceipts] error:', error);
      return res
        .status(500)
        .json({ error: 'ไม่สามารถโหลดรายการใบรับสินค้าได้' });
    }
  }
}

module.exports = new ListPurchaseReceiptsController();
module.exports.ListPurchaseReceiptsController = ListPurchaseReceiptsController;
