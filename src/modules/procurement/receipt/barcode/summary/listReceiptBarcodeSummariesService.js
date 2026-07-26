const repository = require('./listReceiptBarcodeSummariesRepository');

class ListReceiptBarcodeSummariesError extends Error {
  constructor(status, payload) {
    super(payload?.error || 'List receipt barcode summaries failed');
    this.status = status;
    this.payload = payload;
  }
}

const execute = async ({ branchId, printedRaw }) => {
  if (!branchId) {
    throw new ListReceiptBarcodeSummariesError(401, { error: 'unauthorized' });
  }

  const normalized = typeof printedRaw === 'string' ? printedRaw.toLowerCase() : undefined;
  const printed = normalized === 'true' ? true : normalized === 'false' ? false : undefined;
  const receipts = await repository.list({ branchId, printed });

  return receipts.map((receipt) => ({
    id: receipt.id,
    code: receipt.code,
    tax: receipt.supplierTaxInvoiceNumber,
    receivedAt: receipt.receivedAt,
    supplierName: receipt.purchaseOrder?.supplier?.name || '-',
    orderCode: receipt.purchaseOrder?.code || '-',
    totalItems: receipt.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    barcodeGenerated: receipt.items.reduce((sum, item) => sum + (item.stockItems?.length || 0), 0),
    status: receipt.statusReceipt,
    printed: !!receipt.printed,
  }));
};

module.exports = { execute, ListReceiptBarcodeSummariesError };
