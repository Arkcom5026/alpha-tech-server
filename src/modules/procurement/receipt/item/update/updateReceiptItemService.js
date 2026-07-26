const { Prisma } = require('@prisma/client');
const repository = require('./updateReceiptItemRepository');

class UpdateReceiptItemError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const decimalToNumber = (value) => value instanceof Prisma.Decimal ? value.toNumber() : Number(value || 0);

class UpdateReceiptItemService {
  constructor(receiptRepository = repository) {
    this.repository = receiptRepository;
  }

  async execute({ branchId, actor, body }) {
    const receiptId = Number(body?.purchaseOrderReceiptId || body?.receiptId);
    const purchaseOrderItemId = Number(body?.purchaseOrderItemId);
    const quantity = Number(body?.quantity);
    const costPrice = body?.costPrice;
    const forceAccept = !!body?.forceAccept;

    if (!branchId) throw new UpdateReceiptItemError('UNAUTHORIZED', 'unauthorized');
    if (!receiptId || !purchaseOrderItemId || Number.isNaN(quantity) || quantity <= 0 || costPrice === undefined || costPrice === null) {
      throw new UpdateReceiptItemError('INVALID_INPUT', 'receiptId, purchaseOrderItemId, quantity และ costPrice เป็นข้อมูลที่จำเป็น');
    }

    const existingItem = await this.repository.findExisting(receiptId, purchaseOrderItemId, branchId);
    if (!existingItem) throw new UpdateReceiptItemError('NOT_FOUND', 'ไม่พบรายการที่ต้องการอัปเดต');
    if (String(existingItem.receipt?.statusReceipt || '').toUpperCase() === 'COMPLETED') {
      throw new UpdateReceiptItemError('RECEIPT_COMPLETED', 'ใบรับสินค้าถูกปิดแล้ว ไม่สามารถแก้ไขรายการได้');
    }
    if (existingItem.stockItems?.length) {
      throw new UpdateReceiptItemError('STOCK_EXISTS', 'อัปเดตไม่ได้: มีการยิง SN เข้าสต๊อกแล้ว');
    }

    const poQty = decimalToNumber(existingItem.purchaseOrderItem?.quantity);
    if (poQty) {
      const aggregate = await this.repository.sumOtherReceived(
        purchaseOrderItemId,
        existingItem.receipt.branchId,
        existingItem.id
      );
      const alreadyQty = decimalToNumber(aggregate?._sum?.quantity);
      if (alreadyQty + quantity > poQty + 1e-6 && !forceAccept) {
        throw new UpdateReceiptItemError('OVER_RECEIVE', 'จำนวนที่รับรวมเกินจากจำนวนในใบสั่งซื้อ');
      }
      if (alreadyQty + quantity > poQty + 1e-6 && forceAccept) {
        console.warn('[updateReceiptItem] forceAccept over-receive', {
          receiptId,
          purchaseOrderItemId,
          poQty,
          alreadyQty,
          incomingQty: quantity,
          overBy: alreadyQty + quantity - poQty,
          branchId: existingItem.receipt.branchId,
          userId: actor?.id,
          employeeId: actor?.employeeId,
        });
      }
    }

    return this.repository.save({ existingItem, quantity, costPrice });
  }
}

module.exports = new UpdateReceiptItemService();
module.exports.UpdateReceiptItemService = UpdateReceiptItemService;
module.exports.UpdateReceiptItemError = UpdateReceiptItemError;
