const service = require('./getPurchaseReceiptService');
const {
  ReceiptNotFoundError,
  PurchaseOrderMissingError,
} = require('./getPurchaseReceiptService');

class GetPurchaseReceiptController {
  constructor(receiptService = service) {
    this.service = receiptService;
    this.handle = this.handle.bind(this);
  }

  async handle(req, res) {
    try {
      const id = Number(req.params.id);
      const branchId = Number(req.user?.branchId);

      if (!id) {
        return res.status(400).json({ error: 'Missing or invalid receipt ID' });
      }
      if (!branchId) {
        return res.status(401).json({ error: 'unauthorized' });
      }

      const response = await this.service.execute({ id, branchId });
      res.set('Cache-Control', 'no-store');
      return res.json(response);
    } catch (error) {
      if (error instanceof ReceiptNotFoundError) {
        return res.status(404).json({ error: 'ไม่พบใบรับสินค้านี้' });
      }
      if (error instanceof PurchaseOrderMissingError) {
        return res.status(400).json({ error: 'ไม่พบข้อมูลใบสั่งซื้อของใบรับนี้' });
      }

      console.error('❌ [getPurchaseOrderReceiptById] error:', error);
      return res.status(500).json({ error: 'เกิดข้อผิดพลาด ไม่สามารถดึงข้อมูลใบรับสินค้าได้' });
    }
  }
}

module.exports = new GetPurchaseReceiptController();
module.exports.GetPurchaseReceiptController = GetPurchaseReceiptController;
