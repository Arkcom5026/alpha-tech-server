const service = require('./createPurchaseReceiptService');
const { CreatePurchaseReceiptError } = require('./createPurchaseReceiptService');

class CreatePurchaseReceiptController {
  constructor(createService = service, logger = console) {
    this.service = createService;
    this.logger = logger;
    this.handle = this.handle.bind(this);
  }

  async handle(req, res) {
    try {
      const created = await this.service.execute({
        ...(req.body || {}),
        branchId: req.user?.branchId,
        employeeId: req.user?.employeeId,
      });
      return res.status(201).json(created);
    } catch (error) {
      if (error instanceof CreatePurchaseReceiptError) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      this.logger.error('❌ [createPurchaseOrderReceipt] error:', error);
      return res.status(500).json({ error: 'สร้างใบรับสินค้าไม่สำเร็จ' });
    }
  }
}

module.exports = new CreatePurchaseReceiptController();
module.exports.CreatePurchaseReceiptController = CreatePurchaseReceiptController;
