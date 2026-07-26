const repository = require('./deletePurchaseReceiptRepository');

class DeletePurchaseReceiptError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DeletePurchaseReceiptError';
    this.code = code;
  }
}

class DeletePurchaseReceiptService {
  constructor(receiptRepository = repository) {
    this.repository = receiptRepository;
  }

  async execute({ id, branchId }) {
    const normalizedId = Number(id);
    const normalizedBranchId = Number(branchId);
    if (!normalizedBranchId) {
      throw new DeletePurchaseReceiptError('UNAUTHORIZED', 'unauthorized');
    }

    const found = await this.repository.findByIdAndBranch(normalizedId, normalizedBranchId);
    if (!found) {
      throw new DeletePurchaseReceiptError('NOT_FOUND', 'ไม่พบใบรับสินค้านี้');
    }

    await this.repository.deleteById(normalizedId);
    return { success: true };
  }
}

module.exports = new DeletePurchaseReceiptService();
module.exports.DeletePurchaseReceiptService = DeletePurchaseReceiptService;
module.exports.DeletePurchaseReceiptError = DeletePurchaseReceiptError;
