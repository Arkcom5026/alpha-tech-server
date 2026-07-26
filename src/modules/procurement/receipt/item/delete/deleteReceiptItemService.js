const repository = require('./deleteReceiptItemRepository');

class DeleteReceiptItemError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DeleteReceiptItemError';
    this.code = code;
  }
}

class DeleteReceiptItemService {
  constructor(itemRepository = repository) {
    this.repository = itemRepository;
  }

  async execute({ id, branchId }) {
    const normalizedId = Number(id);
    const normalizedBranchId = Number(branchId);
    if (!normalizedBranchId) throw new DeleteReceiptItemError('UNAUTHORIZED', 'unauthorized');
    if (!normalizedId) throw new DeleteReceiptItemError('INVALID_ID', 'Missing or invalid id');

    const found = await this.repository.findByIdAndBranch(normalizedId, normalizedBranchId);
    if (!found) throw new DeleteReceiptItemError('NOT_FOUND', 'ไม่พบรายการสินค้านี้ในสาขา');
    if (found.stockItems?.length) {
      throw new DeleteReceiptItemError('STOCK_EXISTS', 'ลบไม่ได้: มีการยิง SN เข้าสต๊อกแล้ว');
    }

    await this.repository.deleteById(normalizedId);
    return { success: true };
  }
}

module.exports = new DeleteReceiptItemService();
module.exports.DeleteReceiptItemService = DeleteReceiptItemService;
module.exports.DeleteReceiptItemError = DeleteReceiptItemError;
