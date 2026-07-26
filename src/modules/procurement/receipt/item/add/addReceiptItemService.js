const { Prisma } = require('@prisma/client');
const repository = require('./addReceiptItemRepository');

class AddReceiptItemError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const decimalToNumber = (value) => value instanceof Prisma.Decimal ? value.toNumber() : Number(value || 0);

class AddReceiptItemService {
  constructor(receiptRepository = repository) {
    this.repository = receiptRepository;
  }

  async execute({ branchId, actor, body }) {
    const receiptId = Number(body?.purchaseOrderReceiptId || body?.receiptId);
    const purchaseOrderItemId = Number(body?.purchaseOrderItemId);
    const quantity = Number(body?.quantity);
    const costPrice = body?.costPrice;
    const forceAccept = !!body?.forceAccept;

    if (!branchId) throw new AddReceiptItemError('UNAUTHORIZED', 'unauthorized');
    if (!receiptId || !purchaseOrderItemId || Number.isNaN(quantity) || quantity <= 0 || costPrice === undefined || costPrice === null) {
      throw new AddReceiptItemError('INVALID_INPUT', 'receiptId, purchaseOrderItemId, quantity และ costPrice เป็นข้อมูลที่จำเป็น');
    }

    const receipt = await this.repository.findReceipt(receiptId, branchId);
    if (!receipt) throw new AddReceiptItemError('RECEIPT_NOT_FOUND', 'ไม่พบใบรับสินค้านี้ในสาขา');
    if (String(receipt.statusReceipt || '').toUpperCase() === 'COMPLETED') {
      throw new AddReceiptItemError('RECEIPT_COMPLETED', 'ใบรับสินค้าถูกปิดแล้ว ไม่สามารถแก้ไขรายการได้');
    }

    const poItem = await this.repository.findPurchaseOrderItem(purchaseOrderItemId);
    if (!poItem || !poItem.product) {
      throw new AddReceiptItemError('PO_ITEM_INVALID', 'ไม่พบสินค้าในใบสั่งซื้อหรือสินค้าไม่มีข้อมูล');
    }
    if (receipt.purchaseOrderId && poItem.purchaseOrderId && Number(receipt.purchaseOrderId) !== Number(poItem.purchaseOrderId)) {
      throw new AddReceiptItemError('PO_MISMATCH', 'รายการนี้ไม่ใช่ของใบสั่งซื้อเดียวกับใบรับสินค้า');
    }

    const existingItem = await this.repository.findExisting(receiptId, purchaseOrderItemId, receipt.branchId);
    if (existingItem?.stockItems?.length) {
      throw new AddReceiptItemError('STOCK_EXISTS', 'อัปเดตไม่ได้: มีการยิง SN เข้าสต๊อกแล้ว');
    }

    const aggregate = await this.repository.sumOtherReceived(purchaseOrderItemId, receipt.branchId, existingItem?.id);
    const alreadyQty = decimalToNumber(aggregate?._sum?.quantity);
    const poQty = decimalToNumber(poItem.quantity);
    if (poQty && alreadyQty + quantity > poQty + 1e-6 && !forceAccept) {
      throw new AddReceiptItemError('OVER_RECEIVE', 'จำนวนที่รับรวมเกินจากจำนวนในใบสั่งซื้อ');
    }

    if (poQty && alreadyQty + quantity > poQty + 1e-6 && forceAccept) {
      console.warn('[addReceiptItem] forceAccept over-receive', {
        receiptId,
        purchaseOrderItemId,
        poQty,
        alreadyQty,
        incomingQty: quantity,
        overBy: alreadyQty + quantity - poQty,
        branchId: receipt.branchId,
        userId: actor?.id,
        employeeId: actor?.employeeId,
      });
    }

    const saved = await this.repository.save({
      existingItem,
      receiptId,
      purchaseOrderItemId,
      quantity,
      costPrice,
      productId: poItem.productId,
      branchId: receipt.branchId,
    });

    return { item: saved, statusCode: existingItem ? 200 : 201 };
  }
}

module.exports = new AddReceiptItemService();
module.exports.AddReceiptItemService = AddReceiptItemService;
module.exports.AddReceiptItemError = AddReceiptItemError;
