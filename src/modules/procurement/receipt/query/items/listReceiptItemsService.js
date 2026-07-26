const listReceiptItemsRepository = require('./listReceiptItemsRepository');

class ReceiptItemsQueryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ReceiptItemsQueryError';
    this.code = code;
  }
}

class ListReceiptItemsService {
  constructor(repository = listReceiptItemsRepository) {
    this.repository = repository;
  }

  async execute({ receiptId, branchId }) {
    const normalizedReceiptId = Number(receiptId);
    const normalizedBranchId = Number(branchId);

    if (!normalizedBranchId) {
      throw new ReceiptItemsQueryError('UNAUTHORIZED', 'unauthorized');
    }

    if (!normalizedReceiptId) {
      throw new ReceiptItemsQueryError('INVALID_RECEIPT_ID', 'Missing or invalid receiptId');
    }

    const receipt = await this.repository.findBranchScopedReceipt(
      normalizedReceiptId,
      normalizedBranchId
    );

    if (!receipt) {
      throw new ReceiptItemsQueryError(
        'RECEIPT_NOT_FOUND',
        'ไม่พบใบรับสินค้านี้ในสาขา'
      );
    }

    return this.repository.findItems(normalizedReceiptId);
  }
}

module.exports = new ListReceiptItemsService();
module.exports.ListReceiptItemsService = ListReceiptItemsService;
module.exports.ReceiptItemsQueryError = ReceiptItemsQueryError;
