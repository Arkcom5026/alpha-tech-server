const service = require('./deleteReceiptItemService');
const { DeleteReceiptItemError } = require('./deleteReceiptItemService');

class DeleteReceiptItemController {
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
      if (error instanceof DeleteReceiptItemError) {
        if (error.code === 'UNAUTHORIZED') return res.status(401).json({ error: error.message });
        if (error.code === 'INVALID_ID') return res.status(400).json({ error: error.message });
        if (error.code === 'NOT_FOUND') return res.status(404).json({ error: error.message });
        if (error.code === 'STOCK_EXISTS') return res.status(409).json({ error: error.message });
      }
      console.error('❌ [deleteReceiptItem] error:', error);
      return res.status(500).json({ error: 'ไม่สามารถลบรายการสินค้าได้' });
    }
  }
}

module.exports = new DeleteReceiptItemController();
module.exports.DeleteReceiptItemController = DeleteReceiptItemController;
