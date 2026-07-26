const { Prisma } = require('@prisma/client');
const repository = require('./getPurchaseReceiptRepository');

const NORMALIZE_DECIMAL_TO_NUMBER = process.env.NORMALIZE_DECIMAL_TO_NUMBER !== '0';
const toNumber = (value) =>
  value && typeof value === 'object' && typeof value.toNumber === 'function'
    ? value.toNumber()
    : Number(value);

class ReceiptNotFoundError extends Error {}
class PurchaseOrderMissingError extends Error {}

class GetPurchaseReceiptService {
  constructor(receiptRepository = repository) {
    this.repository = receiptRepository;
  }

  async execute({ id, branchId }) {
    const receipt = await this.repository.findReceiptById(id, branchId);
    if (!receipt) throw new ReceiptNotFoundError('RECEIPT_NOT_FOUND');
    if (!receipt.purchaseOrder?.id) throw new PurchaseOrderMissingError('PURCHASE_ORDER_MISSING');

    const receiptIds = await this.repository.findReceiptIdsByPurchaseOrderId(receipt.purchaseOrder.id);
    const links = await this.repository.findPaymentLinksByReceiptIds(receiptIds);
    const totalPaid = links.reduce(
      (sum, row) => sum.plus(row.amountPaid),
      new Prisma.Decimal(0)
    );

    const supplier = { ...receipt.purchaseOrder.supplier };
    if (NORMALIZE_DECIMAL_TO_NUMBER) {
      for (const key of ['creditLimit', 'creditBalance']) {
        if (supplier[key]?.toNumber) supplier[key] = supplier[key].toNumber();
      }
    }

    return {
      ...receipt,
      items: receipt.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        productName: item.purchaseOrderItem.product.name,
        unitName: item.purchaseOrderItem.product.unit?.name || 'N/A',
      })),
      purchaseOrder: {
        ...receipt.purchaseOrder,
        supplier: {
          ...supplier,
          debitAmount: NORMALIZE_DECIMAL_TO_NUMBER ? toNumber(totalPaid) : totalPaid,
        },
      },
    };
  }
}

module.exports = new GetPurchaseReceiptService();
module.exports.GetPurchaseReceiptService = GetPurchaseReceiptService;
module.exports.ReceiptNotFoundError = ReceiptNotFoundError;
module.exports.PurchaseOrderMissingError = PurchaseOrderMissingError;
