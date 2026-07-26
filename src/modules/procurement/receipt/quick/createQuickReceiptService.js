const repository = require('./createQuickReceiptRepository');

class CreateQuickReceiptError extends Error {
  constructor(status, payload) {
    super(payload?.error || 'Create quick receipt failed');
    this.status = status;
    this.payload = payload;
  }
}

const execute = async ({ branchId, receivedById, body }) => {
  if (!branchId || !receivedById) {
    throw new CreateQuickReceiptError(401, { error: 'unauthorized' });
  }

  const { note, supplierId, items = [], flags = {} } = body || {};

  if (!Array.isArray(items) || items.length === 0) {
    throw new CreateQuickReceiptError(400, { error: 'ต้องระบุ items อย่างน้อย 1 รายการ' });
  }

  for (const item of items) {
    if (!item?.productId) {
      throw new CreateQuickReceiptError(400, { error: 'รายการต้องมี productId' });
    }
    if (item?.quantity == null) {
      throw new CreateQuickReceiptError(400, { error: 'รายการต้องมี quantity' });
    }
    if (item?.costPrice == null) {
      throw new CreateQuickReceiptError(400, { error: 'รายการต้องมี costPrice' });
    }
  }

  const created = await repository.create({
    branchId,
    receivedById,
    note,
    supplierId,
    items,
  });

  return { success: true, data: created, flags };
};

module.exports = { execute, CreateQuickReceiptError };
