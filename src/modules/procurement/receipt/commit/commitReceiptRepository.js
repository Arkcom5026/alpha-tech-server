const { prisma } = require('../../../../../lib/prisma');
const { assertProductCanReceive } = require('../../../inventory/policies/productInventoryMutationPolicy');

const toNumber = (value) => Number(value?.toString?.() ?? value ?? 0);

const countBarcodes = ({ id, branchId }) =>
  prisma.barcodeReceiptItem.count({
    where: { purchaseOrderReceiptId: id, branchId },
  });

const isReceiptItemFullyReceived = ({ item, mode }) => {
  const barcodes = Array.isArray(item.barcodeReceiptItem) ? item.barcodeReceiptItem : [];

  if (mode === 'SIMPLE') {
    return barcodes.some((row) => row.simpleLotId != null || String(row.status || '').toUpperCase() === 'SN_RECEIVED');
  }

  const quantity = toNumber(item.quantity);
  const received = barcodes.filter(
    (row) => row.stockItemId != null || String(row.status || '').toUpperCase() === 'SN_RECEIVED',
  ).length;
  return received >= quantity;
};

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

    const itemRuntime = receipt.items.map((item) => {
      const product = item.product || item.purchaseOrderItem?.product;
      if (!product) throw new Error('ไม่พบข้อมูลสินค้าในรายการรับ');
      const { mode } = assertProductCanReceive(product);
      return { item, product, mode };
    });

    const alreadyReceived = itemRuntime.length > 0 && itemRuntime.every(({ item, mode }) =>
      isReceiptItemFullyReceived({ item, mode }));

    if (alreadyReceived) {
      if (receipt.statusReceipt !== 'COMPLETED') {
        await tx.purchaseOrderReceipt.update({
          where: { id },
          data: { statusReceipt: 'COMPLETED' },
        });
      }
      return { id, alreadyReceived: true };
    }

    for (const { item, product, mode } of itemRuntime) {
      if (isReceiptItemFullyReceived({ item, mode })) continue;

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
          data: { simpleLotId: lot.id, status: 'SN_RECEIVED' },
        });

        await tx.stockMovement.create({
          data: {
            productId: product.id,
            branchId,
            type: 'RECEIVE',
            qty: item.quantity,
            simpleLotId: lot.id,
            refType: 'PURCHASE_RECEIPT',
            refId: receipt.id,
            note: `รับสินค้า SIMPLE จากใบรับ #${receipt.id}`,
          },
        });
      } else {
        const quantity = toNumber(item.quantity);
        const serials = await tx.barcodeReceiptItem.findMany({
          where: { receiptItemId: item.id, kind: 'SN', branchId },
          orderBy: { runningNumber: 'asc' },
          select: { id: true, barcode: true, stockItemId: true, status: true },
        });
        if (serials.length < quantity) throw new Error('จำนวน SN ไม่พอสำหรับ commit');

        for (let index = 0; index < quantity; index += 1) {
          const serial = serials[index];
          if (serial.stockItemId != null || String(serial.status || '').toUpperCase() === 'SN_RECEIVED') continue;

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
            data: { stockItemId: stockItem.id, status: 'SN_RECEIVED' },
          });
        }
      }
    }

    await tx.purchaseOrderReceipt.update({
      where: { id },
      data: { statusReceipt: 'COMPLETED' },
    });
    return { id, alreadyReceived: false };
  }, { timeout: 30000, maxWait: 8000 });

module.exports = { countBarcodes, commit, isReceiptItemFullyReceived };
