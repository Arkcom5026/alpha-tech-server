const repository = require('./updatePurchaseReceiptNoteRepository');

class UpdatePurchaseReceiptNoteError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'UpdatePurchaseReceiptNoteError';
    this.code = code;
  }
}

class UpdatePurchaseReceiptNoteService {
  constructor(receiptRepository = repository) {
    this.repository = receiptRepository;
  }

  async execute({ id, branchId, note }) {
    const normalizedId = Number(id);
    const normalizedBranchId = Number(branchId);
    if (!normalizedBranchId) {
      throw new UpdatePurchaseReceiptNoteError('UNAUTHORIZED', 'unauthorized');
    }

    const found = await this.repository.findByIdAndBranch(normalizedId, normalizedBranchId);
    if (!found) {
      throw new UpdatePurchaseReceiptNoteError('NOT_FOUND', 'ไม่พบใบรับสินค้านี้');
    }

    return this.repository.updateNote(normalizedId, note);
  }
}

module.exports = new UpdatePurchaseReceiptNoteService();
module.exports.UpdatePurchaseReceiptNoteService = UpdatePurchaseReceiptNoteService;
module.exports.UpdatePurchaseReceiptNoteError = UpdatePurchaseReceiptNoteError;
