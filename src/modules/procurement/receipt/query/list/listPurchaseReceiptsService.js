const listPurchaseReceiptsRepository = require('./listPurchaseReceiptsRepository');

function normalizeFilters(query = {}) {
  const printedParam =
    typeof query.printed === 'string' ? query.printed.toLowerCase() : undefined;

  return {
    printed:
      printedParam === 'true'
        ? true
        : printedParam === 'false'
          ? false
          : undefined,
    q: typeof query.q === 'string' ? query.q.trim() : '',
    supplier:
      typeof query.supplier === 'string' ? query.supplier.trim() : '',
    supplierId:
      query.supplierId === undefined ||
      query.supplierId === null ||
      query.supplierId === ''
        ? undefined
        : Number(query.supplierId),
  };
}

function mapReceipt(receipt) {
  return {
    id: receipt.id,
    receiptCode: receipt.code,
    poCode: receipt.purchaseOrder?.code || '-',
    supplierId: receipt.purchaseOrder?.supplier?.id || null,
    supplierName: receipt.purchaseOrder?.supplier?.name || '-',
    receivedAt: receipt.receivedAt,
    printed: receipt.printed,
  };
}

class ListPurchaseReceiptsService {
  constructor(repository = listPurchaseReceiptsRepository) {
    this.repository = repository;
  }

  async execute(branchId, query = {}) {
    const filters = normalizeFilters(query);
    const receipts = await this.repository.findMany(branchId, filters);

    return {
      items: receipts.map(mapReceipt),
      filters,
    };
  }
}

module.exports = new ListPurchaseReceiptsService();
module.exports.ListPurchaseReceiptsService = ListPurchaseReceiptsService;
module.exports.normalizeFilters = normalizeFilters;
module.exports.mapReceipt = mapReceipt;
