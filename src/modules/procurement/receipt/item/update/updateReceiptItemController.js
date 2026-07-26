const service = require('./updateReceiptItemService');
const { UpdateReceiptItemError } = require('./updateReceiptItemService');

const STATUS_BY_CODE = {
  UNAUTHORIZED: 401,
  INVALID_INPUT: 400,
  NOT_FOUND: 404,
  RECEIPT_COMPLETED: 409,
  STOCK_EXISTS: 409,
  OVER_RECEIVE: 400,
};

class UpdateReceiptItemController {
  constructor(receiptService = service) {
    this.service = receiptService;
    this.handle = this.handle.bind(this);
  }

  async handle(req, res) {
    try {
      const item = await this.service.execute({
        branchId: Number(req.user?.branchId),
        actor: req.user,
        body: req.body || {},
      });
      return res.json(item);
    } catch (error) {
      if (error instanceof UpdateReceiptItemError) {
        return res.status(STATUS_BY_CODE[error.code] || 400).json({ error: error.message });
      }
      console.error('❌ [updateReceiptItem] error:', error);
      return res.status(500).json({ error: 'ไม่สามารถอัปเดตรายการสินค้าได้' });
    }
  }
}

module.exports = new UpdateReceiptItemController();
module.exports.UpdateReceiptItemController = UpdateReceiptItemController;
