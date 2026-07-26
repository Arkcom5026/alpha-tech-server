const { prisma } = require('../../../../../lib/prisma');

const toNumber = (value) => Number(value?.toString?.() ?? value ?? 0);

const countBarcodes = ({ id, branchId }) =>
  prisma.barcodeReceiptItem.count({
    where: { purchaseOrderReceiptId: id, branchId },
  });

const commit = ({ id, branchId }) =>
  prisma.$transaction(async (tx) => {
    const receipt = await tx.purchaseOrderReceipt.findFirst({
      where: { id, branchId },
      include: {
        items: {
          include: {
            product: true,
            purchaseOrderItem: { include: { product: true } },
            barcodeReceiptItem: true,
          },
        },
      },
    });
    if (!receipt) throw new Error('ไม่พบเอกสารในสาขานี้');

    for (const item of receipt.items) {
      const product = item.product || item.purchaseOrderItem?.product;
      if (!product) throw new Error('ไม่พบข้อมูลสินค้าในรายการรับ');
      const mode = product.mode || 'STRUCTURED';

      if (mode === 'SIMPLE') {
        const lotCodes = await tx.barcodeReceiptItem.findMany({
          where: { receiptItemId: item.id, kind: 'LOT', branchId },
          orderBy: { runningNumber: 'asc' },
          select: { barcode: true },
        });
        if (!lotCodes.length) throw new Error('ไม่พบ LOT barcode สำหรับรายการนี้');

        const lot = await tx.simpleLot.create({
          data: {
            branchId,
            productId: product.id,
            receiptItem: { connect: { id: item.id } },
            barcode: lotCodes[0].barcode,
            qtyInitial: item.quantity,
            qtyRemaining: item.quantity,
            unitCost: item.costPrice,
            status: 'ACTIVE',
          },
        });

        await tx.stockBalance.upsert({
          where: { productId_branchId: { productId: product.id, branchId } },
          update: { quantity: { increment: item.quantity } },
          create: { productId: product.id, branchId, quantity: item.quantity },
        });

        await tx.barcodeReceiptItem.updateMany({
          where: { receiptItemId: item.id, kind: 'LOT', branchId },
          data: { simpleLotId: lot.id },
        });
      } else {
        const quantity = toNumber(item.quantity);
        const serials = await tx.barcodeReceiptItem.findMany({
          where: { receiptItemId: item.id, kind: 'SN', branchId },
          orderBy: { runningNumber: 'asc' },
          select: { id: true, barcode: true },
        });
        if (serials.length < quantity) throw new Error('จำนวน SN ไม่พอสำหรับ commit');

        for (let index = 0; index < quantity; index += 1) {
          const serial = serials[index];
          const stockItem = await tx.stockItem.create({
            data: {
              branchId,
              productId: product.id,
              status: 'IN_STOCK',
              serialNumber: serial.barcode,
              purchaseOrderReceiptItemId: item.id,
            },
            select: { id: true },
          });
          await tx.barcodeReceiptItem.update({
            where: { id: serial.id },
            data: { stockItemId: stockItem.id },
          });
        }
      }
    }

    await tx.purchaseOrderReceipt.update({
      where: { id },
      data: { statusReceipt: 'COMPLETED' },
    });
    return { id };
  }, { timeout: 30000, maxWait: 8000 });

module.exports = { countBarcodes, commit };
