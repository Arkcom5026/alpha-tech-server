const listEligiblePurchaseOrdersService = require('./listEligiblePurchaseOrdersService');
const { EligiblePurchaseOrdersQueryError } = require('./listEligiblePurchaseOrdersService');

class ListEligiblePurchaseOrdersController {
  constructor(service = listEligiblePurchaseOrdersService) {
    this.service = service;
    this.handle = this.handle.bind(this);
  }

  async handle(req, res) {
    try {
      const purchaseOrders = await this.service.execute({
        branchId: req.user?.branchId,
      });
      return res.json(purchaseOrders);
    } catch (error) {
      if (error instanceof EligiblePurchaseOrdersQueryError && error.code === 'UNAUTHORIZED') {
        return res.status(401).json({ error: 'unauthorized' });
      }
      console.error('❌ [listEligiblePurchaseOrders] error:', error);
      return res.status(500).json({
        error: 'ไม่สามารถโหลดใบสั่งซื้อสำหรับสร้างใบรับสินค้าได้',
      });
    }
  }
}

module.exports = new ListEligiblePurchaseOrdersController();
module.exports.ListEligiblePurchaseOrdersController = ListEligiblePurchaseOrdersController;
