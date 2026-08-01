const { prisma } = require('../../../../../lib/prisma');

const findBranchFeatures = (branchId) =>
  prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, features: true },
  });

const findManagerPinHash = (userId, branchId) =>
  prisma.employeeProfile.findFirst({
    where: { userId, branchId },
    select: { managerPinHash: true },
  });

const findLatestPurchaseOrderCode = (prefix) =>
  prisma.purchaseOrder.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });

const findLatestReceiptCode = (prefix) =>
  prisma.purchaseOrderReceipt.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });

const createReceiptTransaction = ({
  branchId,
  userId,
  supplierId,
  payment,
  note,
  vatRate,
  summary,
  items,
  poCode,
  receiptCode,
}) =>
  prisma.$transaction(async (tx) => {
    const employee = await tx.employeeProfile.findFirst({
      where: { userId, branchId },
      select: { id: true },
    });

    if (!employee) {
      const error = new Error('ไม่พบข้อมูลพนักงานของผู้ใช้งานในสาขานี้');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    const purchaseOrder = await tx.purchaseOrder.create({
      data: {
        code: poCode,
        branchId,
        supplierId,
        employeeId: employee.id,
        status: 'RECEIVED',
        note: note || '',
      },
    });

    const purchaseOrderItems = [];
    for (const item of items) {
      purchaseOrderItems.push(
        await tx.purchaseOrderItem.create({
          data: {
            purchaseOrderId: purchaseOrder.id,
            productId: item.productId,
            quantity: item.qty,
            costPrice: item.unitCost,
          },
        })
      );
    }

    const receipt = await tx.purchaseOrderReceipt.create({
      data: {
        code: receiptCode,
        branchId,
        purchaseOrderId: purchaseOrder.id,
        receivedById: employee.id,
        vatRate,
        totalAmount: summary.total,
        note: note || '',
      },
    });

    const receiptItems = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const purchaseOrderItem = purchaseOrderItems[index];
      receiptItems.push(
        await tx.purchaseOrderReceiptItem.create({
          data: {
            receiptId: receipt.id,
            purchaseOrderItemId: purchaseOrderItem.id,
            quantity: item.qty,
            costPrice: item.unitCost,
          },
        })
      );
      await tx.purchaseOrderItem.update({
        where: { id: purchaseOrderItem.id },
        data: { receivedQuantity: { increment: item.qty } },
      });
    }

    for (const item of items) {
      await tx.branchInventory.upsert({
        where: { productId_branchId: { productId: item.productId, branchId } },
        update: {
          quantity: { increment: item.qty },
          lastReceivedCost: item.unitCost,
        },
        create: {
          productId: item.productId,
          branchId,
          quantity: item.qty,
          avgCost: item.unitCost,
          lastReceivedCost: item.unitCost,
        },
      });
      await tx.stockMovement.create({
        data: {
          branchId,
          productId: item.productId,
          qty: item.qty,
          type: 'RECEIVE',
          refType: 'PURCHASE_ORDER_RECEIPT',
          refId: receipt.id,
        },
      });
    }

    const inventoryTransactionIds = [];
    for (const item of items) {
      try {
        const transaction = await tx.inventoryTransaction.create({
          data: {
            branchId,
            productId: item.productId,
            qty: Number(item.qty),
            unitCost: Number(item.unitCost || 0),
            type: 'RECEIPT_PO',
            refType: 'PO_RECEIPT',
            refId: receipt.id,
            note: 'Receipt Simple',
            createdBy: userId,
          },
        });
        inventoryTransactionIds.push(transaction.id);
      } catch (_) {}
    }

    let paymentId = null;
    if (payment && payment.method) {
      try {
        const createdPayment = await tx.payment.create({
          data: {
            branchId,
            supplierId,
            amount: Number(payment.paidAmount || 0),
            method: String(payment.method),
            note: payment.note || 'Receipt Simple',
            refType: 'PO_RECEIPT',
            refId: receipt.id,
            createdBy: userId,
          },
        });
        paymentId = createdPayment.id;
      } catch (_) {}
    }

    return {
      purchaseOrder,
      purchaseOrderItems,
      receipt,
      receiptItems,
      inventoryTransactionIds,
      paymentId,
    };
  });

module.exports = {
  findBranchFeatures,
  findManagerPinHash,
  findLatestPurchaseOrderCode,
  findLatestReceiptCode,
  createReceiptTransaction,
};
