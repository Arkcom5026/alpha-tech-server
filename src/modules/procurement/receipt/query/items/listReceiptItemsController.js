const listReceiptItemsService = require('./listReceiptItemsService');

class ListReceiptItemsController {
  constructor(service = listReceiptItemsService) {
    this.service = service;
    this.handle = this.handle.bind(this);
  }

  async handle(req, res) {
    try {
      const items = await this.service.execute({
        receiptId: req.params?.receiptId,
        branchId: req.user?.branchId,
      });

      return res.json(items);
    } catch (error) {
      if (error?.code === 'UNAUTHORIZED') {
        return res.status(401).json({ error: 'unauthorized' });
      }

      if (error?.code === 'INVALID_RECEIPT_ID') {
        return res.status(400).json({ error: 'Missing or invalid receiptId' });
      }

      if (error?.code === 'RECEIPT_NOT_FOUND') {
        return res.status(404).json({ error: 'ไม่พบใบรับสินค้านี้ในสาขา' });
      }

      console.error('❌ [listReceiptItems] error:', error);
      return res.status(500).json({ error: 'ไม่สามารถโหลดรายการสินค้าได้' });
    }
  }
}

module.exports = new ListReceiptItemsController();
module.exports.ListReceiptItemsController = ListReceiptItemsController;
