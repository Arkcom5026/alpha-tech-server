const service = require('./deletePurchaseReceiptService');
const { DeletePurchaseReceiptError } = require('./deletePurchaseReceiptService');

class DeletePurchaseReceiptController {
  constructor(deleteService = service) {
    this.service = deleteService;
    this.handle = this.handle.bind(this);
  }

  async handle(req, res) {
    try {
      return res.json(
        await this.service.execute({ id: req.params.id, branchId: req.user?.branchId })
      );
    } catch (error) {
      if (error instanceof DeletePurchaseReceiptError) {
        if (error.code === 'UNAUTHORIZED') return res.status(401).json({ error: error.message });
        if (error.code === 'NOT_FOUND') return res.status(404).json({ error: error.message });
      }
      console.error('❌ [deletePurchaseReceipt] error:', error);
      return res.status(500).json({ error: 'ไม่สามารถลบใบรับสินค้าได้' });
    }
  }
}

module.exports = new DeletePurchaseReceiptController();
module.exports.DeletePurchaseReceiptController = DeletePurchaseReceiptController;
