const service = require('./addReceiptItemService');
const { AddReceiptItemError } = require('./addReceiptItemService');

const STATUS_BY_CODE = {
  UNAUTHORIZED: 401,
  INVALID_INPUT: 400,
  RECEIPT_NOT_FOUND: 404,
  RECEIPT_COMPLETED: 409,
  PO_ITEM_INVALID: 400,
  PO_MISMATCH: 400,
  STOCK_EXISTS: 409,
  OVER_RECEIVE: 400,
};

class AddReceiptItemController {
  constructor(receiptService = service) {
    this.service = receiptService;
    this.handle = this.handle.bind(this);
  }

  async handle(req, res) {
    try {
      const result = await this.service.execute({
        branchId: Number(req.user?.branchId),
        actor: req.user,
        body: req.body || {},
      });
      return res.status(result.statusCode).json(result.item);
    } catch (error) {
      if (error instanceof AddReceiptItemError) {
        return res.status(STATUS_BY_CODE[error.code] || 400).json({ error: error.message });
      }
      console.error('❌ [addReceiptItem] error:', error);
      return res.status(500).json({ error: 'ไม่สามารถเพิ่มรายการรับสินค้าได้' });
    }
  }
}

module.exports = new AddReceiptItemController();
module.exports.AddReceiptItemController = AddReceiptItemController;
