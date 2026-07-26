const service = require('./updatePurchaseReceiptNoteService');
const { UpdatePurchaseReceiptNoteError } = require('./updatePurchaseReceiptNoteService');

class UpdatePurchaseReceiptNoteController {
  constructor(updateService = service) {
    this.service = updateService;
    this.handle = this.handle.bind(this);
  }

  async handle(req, res) {
    try {
      const updated = await this.service.execute({
        id: req.params.id,
        branchId: req.user?.branchId,
        note: req.body?.note,
      });
      return res.json(updated);
    } catch (error) {
      if (error instanceof UpdatePurchaseReceiptNoteError) {
        if (error.code === 'UNAUTHORIZED') return res.status(401).json({ error: error.message });
        if (error.code === 'NOT_FOUND') return res.status(404).json({ error: error.message });
      }
      console.error('❌ [updatePurchaseReceiptNote] error:', error);
      return res.status(500).json({ error: 'ไม่สามารถแก้ไขใบรับสินค้าได้' });
    }
  }
}

module.exports = new UpdatePurchaseReceiptNoteController();
module.exports.UpdatePurchaseReceiptNoteController = UpdatePurchaseReceiptNoteController;
