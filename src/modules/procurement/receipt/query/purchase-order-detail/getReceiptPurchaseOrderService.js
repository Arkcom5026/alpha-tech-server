const getReceiptPurchaseOrderRepository = require('./getReceiptPurchaseOrderRepository');

const toNumber = (value) =>
  value && typeof value === 'object' && typeof value.toNumber === 'function'
    ? value.toNumber()
    : Number(value);

class ReceiptPurchaseOrderQueryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ReceiptPurchaseOrderQueryError';
    this.code = code;
  }
}

class GetReceiptPurchaseOrderService {
  constructor(repository = getReceiptPurchaseOrderRepository) {
    this.repository = repository;
  }

  async execute({ id, branchId }) {
    const normalizedId = Number(id);
    const normalizedBranchId = Number(branchId);

    if (!normalizedBranchId) {
      throw new ReceiptPurchaseOrderQueryError('UNAUTHORIZED', 'unauthorized');
    }

    const purchaseOrder = await this.repository.findByIdAndBranch(
      normalizedId,
      normalizedBranchId
    );

    if (!purchaseOrder) {
      throw new ReceiptPurchaseOrderQueryError('NOT_FOUND', 'ไม่พบใบสั่งซื้อนี้');
    }

    const items = purchaseOrder.items.map((item) => ({
      ...item,
      receivedQuantity:
        item.receiptItems?.reduce((sum, receiptItem) => sum + toNumber(receiptItem.quantity), 0) || 0,
    }));

    return { ...purchaseOrder, items };
  }
}

module.exports = new GetReceiptPurchaseOrderService();
module.exports.GetReceiptPurchaseOrderService = GetReceiptPurchaseOrderService;
module.exports.ReceiptPurchaseOrderQueryError = ReceiptPurchaseOrderQueryError;
module.exports.toNumber = toNumber;
