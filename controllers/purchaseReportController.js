// src/controllers/purchaseReportController.js

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
    const { dateFrom, dateTo, supplierId, productId, status } = req.query || {};

    // ✅ 3) Where clause (ReceiptItem เป็นตารางหลัก)
    const whereClause = {
      receipt: {
        branchId,
        receivedAt: {
          gte: dateFrom ? startOfDay(dateFrom) : undefined,
          lte: dateTo ? endOfDay(dateTo) : undefined,
        },
        purchaseOrder: {
          supplierId: toInt(supplierId),
          status: status || undefined, // สถานะของ PO (ถ้า FE ส่งมา)
          supplier: { isSystem: false }, // ❌ ตัดใบรับจาก supplier ระบบ
        },
      },
      purchaseOrderItem: {
        productId: toInt(productId),
      },
    };

    // ✅ 4) Query
    const receiptItems = await prisma.purchaseOrderReceiptItem.findMany({
      where: whereClause,
      include: {
        receipt: {
          include: {
            branch: true,
            purchaseOrder: { include: { supplier: true } },
          },
        },
        purchaseOrderItem: {
          include: {
            product: {
              include: {
                template: { include: { unit: true } },
              },
            },
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
      return {
        receiptId: item.receipt.id,
        receiptCode: item.receipt.code,
        receiptDate: item.receipt.receivedAt,
        poCode: item.receipt.purchaseOrder.code,
        supplierName: item.receipt.purchaseOrder.supplier.name,
        branchName: item.receipt.branch.name,
        productName: item.purchaseOrderItem.product.name,
        quantity: Number(qtyDec),
        unitName: item.purchaseOrderItem.product.template.unit?.name || 'N/A',
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
        supplierId: toInt(supplierId) || null,
        productId: toInt(productId) || null,
        status: status || null,
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
