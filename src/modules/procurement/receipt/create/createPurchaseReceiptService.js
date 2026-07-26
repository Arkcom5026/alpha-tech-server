const repository = require('./createPurchaseReceiptRepository');

class CreatePurchaseReceiptError extends Error {
  constructor(code, message, statusCode) {
    super(message);
    this.name = 'CreatePurchaseReceiptError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

class CreatePurchaseReceiptService {
  constructor(receiptRepository = repository, logger = console) {
    this.repository = receiptRepository;
    this.logger = logger;
  }

  async execute(input) {
    const purchaseOrderId = Number(input.purchaseOrderId);
    const branchId = Number(input.branchId);
    const employeeId = Number(input.employeeId);

    if (!purchaseOrderId || !branchId || !employeeId) {
      throw new CreatePurchaseReceiptError(
        'INVALID_INPUT',
        'ข้อมูลไม่ครบ (purchaseOrderId/branchId/employeeId)',
        400
      );
    }

    const purchaseOrder = await this.repository.findPurchaseOrder(
      purchaseOrderId,
      branchId
    );
    if (!purchaseOrder || Number(purchaseOrder.branchId) !== branchId) {
      throw new CreatePurchaseReceiptError(
        'PURCHASE_ORDER_NOT_FOUND',
        'ไม่พบใบสั่งซื้อในสาขานี้',
        404
      );
    }

    const created = await this.repository.createWithUniqueCode({
      purchaseOrderId,
      branchId,
      employeeId,
      note: input.note || null,
      supplierTaxInvoiceNumber: input.supplierTaxInvoiceNumber || null,
      supplierTaxInvoiceDate: input.supplierTaxInvoiceDate
        ? new Date(input.supplierTaxInvoiceDate)
        : null,
      receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
    });

    for (const item of purchaseOrder.items) {
      try {
        await this.repository.upsertBranchPrice({
          productId: item.productId,
          branchId,
          costPrice: item.costPrice,
        });
      } catch (error) {
        this.logger.warn(
          '[createPurchaseOrderReceipt] upsert branchPrice warning:',
          error?.message || error
        );
      }
    }

    return created;
  }
}

module.exports = new CreatePurchaseReceiptService();
module.exports.CreatePurchaseReceiptService = CreatePurchaseReceiptService;
module.exports.CreatePurchaseReceiptError = CreatePurchaseReceiptError;
