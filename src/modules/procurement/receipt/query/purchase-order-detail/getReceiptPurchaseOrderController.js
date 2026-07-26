const getReceiptPurchaseOrderService = require('./getReceiptPurchaseOrderService');
const { ReceiptPurchaseOrderQueryError } = require('./getReceiptPurchaseOrderService');

class GetReceiptPurchaseOrderController {
  constructor(service = getReceiptPurchaseOrderService) {
    this.service = service;
    this.handle = this.handle.bind(this);
  }

  async handle(req, res) {
    try {
      const purchaseOrder = await this.service.execute({
        id: req.params.id,
        branchId: req.user?.branchId,
      });
      return res.json(purchaseOrder);
    } catch (error) {
      if (error instanceof ReceiptPurchaseOrderQueryError) {
        if (error.code === 'UNAUTHORIZED') {
          return res.status(401).json({ error: 'unauthorized' });
        }
        if (error.code === 'NOT_FOUND') {
          return res.status(404).json({ error: 'ไม่พบใบสั่งซื้อนี้' });
        }
      }
      console.error('❌ [getReceiptPurchaseOrder] error:', error);
      return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลใบสั่งซื้อได้' });
    }
  }
}

module.exports = new GetReceiptPurchaseOrderController();
module.exports.GetReceiptPurchaseOrderController = GetReceiptPurchaseOrderController;
