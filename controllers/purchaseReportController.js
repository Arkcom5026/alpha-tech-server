

// src/controllers/purchaseReportController.js
/* eslint-env node */

// ✅ Use shared Prisma singleton and Decimal-safe math
const { prisma, Prisma } = require('../lib/prisma');

const D = (v) => (v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v ?? 0));
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : parseInt(v, 10));
const startOfDay = (d) => new Date(new Date(d).setHours(0, 0, 0, 0));
const endOfDay = (d) => new Date(new Date(d).setHours(23, 59, 59, 999));

/**
 * Controller สำหรับดึงข้อมูลรายงานการจัดซื้อ (BRANCH_SCOPE_ENFORCED)
 * - ตัด supplier ระบบ (isSystem = true) ออกจากรายงานภาษี/จัดซื้อ
 * - Decimal-safe: คูณจำนวน x ต้นทุน ด้วย Prisma.Decimal
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getPurchaseReport = async (req, res) => {
  try {
    // ✅ 1) Branch scope จาก token
    const branchId = toInt(req.user?.branchId);
    if (!branchId) {
      return res.status(403).json({ message: 'ไม่สามารถระบุสาขาของผู้ใช้ได้' });
    }

    // ✅ 2) Filters
    const { dateFrom, dateTo, supplierId, productId, receiptStatus, paymentStatus } = req.query || {};

    // ✅ 3) Where clause (ReceiptItem เป็นตารางหลัก)
    // ✅ 3) Where clause (ReceiptItem เป็นตารางหลัก)
    // หมายเหตุ: ใบรับมีได้ 2 แบบ
    // - PO: supplier อยู่ที่ receipt.purchaseOrder.supplier
    // - QUICK: supplier อยู่ที่ receipt.supplier
    // เราจึงต้องใช้ OR เพื่อรองรับทั้งสองแบบ และยังต้องตัด supplier ระบบ
    const supplierIdInt = toInt(supplierId);

    const whereClause = {
      receipt: {
        branchId,
        receivedAt: {
          gte: dateFrom ? startOfDay(dateFrom) : undefined,
          lte: dateTo ? endOfDay(dateTo) : undefined,
        },
        statusReceipt: receiptStatus && receiptStatus !== 'all' ? receiptStatus : undefined,
        statusPayment: paymentStatus && paymentStatus !== 'all' ? paymentStatus : undefined,
        OR: [
          // PO receipts
          {
            purchaseOrder: {
              supplier: {
                isSystem: false,
                id: supplierIdInt,
              },
            },
          },
          // QUICK receipts
          {
            supplier: {
              isSystem: false,
              id: supplierIdInt,
            },
          },
        ],
      },
      // Product filter: รองรับ QUICK ที่ผูก productId ตรง
      productId: toInt(productId),
    };

    // ✅ 4) Query
    const receiptItems = await prisma.purchaseOrderReceiptItem.findMany({
      where: whereClause,
      include: {
        receipt: {
          include: {
            branch: true,
            supplier: true,
            purchaseOrder: { include: { supplier: true } },
          },
        },
        // PO path
        purchaseOrderItem: {
          include: {
            product: {
              include: {
                unit: true,
                template: { include: { unit: true } },
              },
            },
          },
        },
        // QUICK path
        product: {
          include: {
            unit: true,
            template: { include: { unit: true } },
          },
        },
      },
      orderBy: { receipt: { receivedAt: 'desc' } },
    });

    // ✅ 5) Transform (Decimal-safe)
    const formattedData = receiptItems.map((item) => {
      const qtyDec = D(item.quantity);
      const costDec = D(item.costPrice);
      const totalDec = qtyDec.times(costDec);

      const product = item.purchaseOrderItem?.product || item.product;
      const unitName = product?.unit?.name || product?.template?.unit?.name || 'N/A';
      const supplierName =
        item.receipt.purchaseOrder?.supplier?.name ||
        item.receipt.supplier?.name ||
        'N/A';

      return {
        receiptId: item.receipt.id,
        receiptCode: item.receipt.code,
        receiptDate: item.receipt.receivedAt,
        receiptStatus: item.receipt.statusReceipt,
        paymentStatus: item.receipt.statusPayment,
        poCode: item.receipt.purchaseOrder?.code || null,
        supplierName,
        branchName: item.receipt.branch.name,
        productName: product?.name || 'N/A',
        quantity: Number(qtyDec),
        unitName,
        costPrice: Number(costDec),
        totalCost: Number(totalDec),
      };
    });

    // ✅ 6) Summary (Decimal-safe reduce)
    const summaryDec = receiptItems.reduce(
      (acc, item) => acc.plus(D(item.quantity).times(D(item.costPrice))),
      new Prisma.Decimal(0)
    );

    const totalItems = receiptItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const uniqueReceipts = new Set(receiptItems.map((i) => i.receipt.code)).size;

    // ✅ 7) Response
    res.status(200).json({
      message: 'Successfully fetched purchase report.',
      data: formattedData,
      summary: {
        totalAmount: Number(summaryDec),
        totalItems,
        uniqueReceipts,
      },
      filters: {
        branchId,
        dateFrom: dateFrom ? startOfDay(dateFrom) : null,
        dateTo: dateTo ? endOfDay(dateTo) : null,
        supplierId: supplierIdInt || null,
        productId: toInt(productId) || null,
        receiptStatus: receiptStatus || null,
        paymentStatus: paymentStatus || null,
      },
    });
  } catch (error) {
    console.error('Error fetching purchase report:', error);
    res.status(500).json({
      message: 'An error occurred while fetching the purchase report.',
      error: error?.message || String(error),
    });
  }
};

module.exports = { getPurchaseReport };








