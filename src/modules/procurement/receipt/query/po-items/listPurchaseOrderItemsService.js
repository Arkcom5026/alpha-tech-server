const repository = require('./listPurchaseOrderItemsRepository');

class ListPurchaseOrderItemsError extends Error {
  constructor(status, payload) {
    super(payload?.message || payload?.error || 'List purchase order items failed');
    this.status = status;
    this.payload = payload;
  }
}

const execute = async ({ poId, branchId }) => {
  if (!poId) {
    throw new ListPurchaseOrderItemsError(400, { message: 'Missing PO ID' });
  }

  return repository.listByPurchaseOrder({ poId, branchId });
};

module.exports = { execute, ListPurchaseOrderItemsError };
