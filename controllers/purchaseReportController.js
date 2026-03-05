


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

// ============================================================================
// ✅ NEW (Production): Receipt-level summary + receipt detail
// - Keep getPurchaseReport() as Line-level (backward compatible)
// - Add 2 endpoints:
//    1) getPurchaseReceiptReport()          -> summary list (1 row per RC)
//    2) getPurchaseReceiptReportDetail()    -> detail for 1 RC
// ============================================================================

/**
 * รายงานการจัดซื้อแบบ “รวมเป็นใบ (Receipt-level)”
 * - 1 แถว = 1 ใบรับ (RC)
 * - ตัด supplier ระบบ (isSystem=true)
 * - รองรับ PO และ QUICK ด้วย OR
 *
 * Query:
 *   GET /api/purchase-reports/receipts?dateFrom&dateTo&supplierId&receiptStatus&paymentStatus&productId
 */
const getPurchaseReceiptReport = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    if (!branchId) {
      return res.status(403).json({ message: 'ไม่สามารถระบุสาขาของผู้ใช้ได้' });
    }

    const { dateFrom, dateTo, supplierId, receiptStatus, paymentStatus, productId } = req.query || {};

    const supplierIdInt = toInt(supplierId);
    const productIdInt = toInt(productId);

    // ✅ Base filters (Receipt)
    const receiptWhere = {
      branchId,
      receivedAt: {
        gte: dateFrom ? startOfDay(dateFrom) : undefined,
        lte: dateTo ? endOfDay(dateTo) : undefined,
      },
      statusReceipt: receiptStatus && receiptStatus !== 'all' ? receiptStatus : undefined,
      statusPayment: paymentStatus && paymentStatus !== 'all' ? paymentStatus : undefined,
    };

    // ✅ IMPORTANT: Only apply supplier OR filter when supplierId is provided
    // Otherwise, we only need to exclude system suppliers.
    // - PO receipts: supplier is receipt.purchaseOrder.supplier
    // - QUICK receipts: supplier is receipt.supplier
    // We enforce "non-system supplier" for whichever path exists.

    // ✅ 1) Fetch receipt headers (lightweight)
    const receipts = await prisma.purchaseOrderReceipt.findMany({
      where: {
        ...receiptWhere,
        // Product filter on receipts (only if provided): exists item with productId
        ...(productIdInt
          ? {
              items: {
                some: {
                  productId: productIdInt,
                },
              },
            }
          : {}),
        // Supplier filter (only if provided)
        ...(supplierIdInt
          ? {
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
            }
          : {
              // No supplierId -> just exclude system suppliers for both paths
              OR: [
                {
                  purchaseOrder: {
                    supplier: { isSystem: false },
                  },
                },
                {
                  supplier: { isSystem: false },
                },
              ],
            }),
      },
      orderBy: { receivedAt: 'desc' },
      select: {
        id: true,
        code: true,
        receivedAt: true,
        statusReceipt: true,
        statusPayment: true,
        totalAmount: true,
        paidAmount: true,
        supplier: { select: { id: true, name: true, isSystem: true } },
        purchaseOrder: {
          select: {
            id: true,
            code: true,
            supplier: { select: { id: true, name: true, isSystem: true } },
          },
        },
        _count: { select: { items: true } },
      },
    });

    if (!receipts.length) {
      return res.status(200).json({
        message: 'Successfully fetched purchase receipt report.',
        data: [],
        summary: {
          receiptCount: 0,
          itemCount: 0,
          totalAmount: 0,
        },
        filters: {
          branchId,
          dateFrom: dateFrom ? startOfDay(dateFrom) : null,
          dateTo: dateTo ? endOfDay(dateTo) : null,
          supplierId: supplierIdInt || null,
          productId: productIdInt || null,
          receiptStatus: receiptStatus || null,
          paymentStatus: paymentStatus || null,
        },
      });
    }

    // ✅ 2) Compute totals per receipt via SQL (fast & accurate)
    // - If receipt.totalAmount is present, we still compute to be safe, but we will prefer stored value.
    // - Uses receiptItem.productId (for QUICK/PO unified)
    const receiptIds = receipts.map((r) => r.id);

    // Build dynamic SQL parts for optional product filter
    const hasProductFilter = Number.isFinite(productIdInt);

    // NOTE: Using $queryRaw with parameter binding (safe)
    const totalsRows = await prisma.$queryRaw(
      Prisma.sql`
        SELECT
          i."receiptId" AS "receiptId",
          COUNT(*)::int AS "itemCount",
          COALESCE(SUM((i."quantity") * (i."costPrice")), 0) AS "totalAmount"
        FROM "PurchaseOrderReceiptItem" i
        WHERE i."receiptId" IN (${Prisma.join(receiptIds)})
          ${hasProductFilter ? Prisma.sql`AND i."productId" = ${productIdInt}` : Prisma.empty}
        GROUP BY i."receiptId"
      `
    );

    const totalsMap = new Map();
    for (const row of totalsRows || []) {
      const rid = Number(row.receiptId);
      totalsMap.set(rid, {
        itemCount: Number(row.itemCount ?? 0),
        totalAmount: D(row.totalAmount),
      });
    }

    // ✅ 3) Format response rows
    const data = receipts.map((r) => {
      const supplierName = r.purchaseOrder?.supplier?.name || r.supplier?.name || 'N/A';
      const poCode = r.purchaseOrder?.code || null;

      const totals = totalsMap.get(r.id) || { itemCount: r._count?.items || 0, totalAmount: D(0) };

      // Prefer stored totalAmount if exists (production-friendly)
      const effectiveTotal = r.totalAmount != null ? D(r.totalAmount) : totals.totalAmount;

      return {
        receiptId: r.id,
        receiptCode: r.code,
        receiptDate: r.receivedAt,
        receiptStatus: r.statusReceipt,
        paymentStatus: r.statusPayment,
        supplierName,
        poCode,
        itemCount: totals.itemCount,
        totalAmount: Number(effectiveTotal),
        paidAmount: Number(D(r.paidAmount)),
      };
    });

    // ✅ 4) Summary
    const receiptCount = data.length;
    const itemCount = data.reduce((sum, x) => sum + Number(x.itemCount || 0), 0);
    const totalAmountDec = data.reduce((acc, x) => acc.plus(D(x.totalAmount)), new Prisma.Decimal(0));

    return res.status(200).json({
      message: 'Successfully fetched purchase receipt report.',
      data,
      summary: {
        receiptCount,
        itemCount,
        totalAmount: Number(totalAmountDec),
      },
      filters: {
        branchId,
        dateFrom: dateFrom ? startOfDay(dateFrom) : null,
        dateTo: dateTo ? endOfDay(dateTo) : null,
        supplierId: supplierIdInt || null,
        productId: productIdInt || null,
        receiptStatus: receiptStatus || null,
        paymentStatus: paymentStatus || null,
      },
    });
  } catch (error) {
    console.error('Error fetching purchase receipt report:', error);
    return res.status(500).json({
      message: 'An error occurred while fetching the purchase receipt report.',
      error: error?.message || String(error),
    });
  }
};

/**
 * รายงานการจัดซื้อแบบ “รายละเอียดใบ (Receipt Detail)”
 * - ใช้สำหรับหน้า drill-down เมื่อคลิกจาก summary list
 *
 * Route:
 *   GET /api/purchase-reports/receipts/:receiptId
 */
const getPurchaseReceiptReportDetail = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    if (!branchId) {
      return res.status(403).json({ message: 'ไม่สามารถระบุสาขาของผู้ใช้ได้' });
    }

    const receiptId = toInt(req.params?.receiptId);
    if (!receiptId) {
      return res.status(400).json({ message: 'receiptId ไม่ถูกต้อง' });
    }

    const receipt = await prisma.purchaseOrderReceipt.findFirst({
      where: { id: receiptId, branchId },
      include: {
        branch: true,
        supplier: true,
        purchaseOrder: { include: { supplier: true } },
      },
    });

    if (!receipt) {
      return res.status(404).json({ message: 'ไม่พบใบรับสินค้าที่ต้องการ' });
    }

    // ✅ Items (line-level inside 1 receipt)
    const receiptItems = await prisma.purchaseOrderReceiptItem.findMany({
      where: {
        receiptId,
        receipt: { branchId },
      },
      include: {
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
      orderBy: { id: 'asc' },
    });

    const items = receiptItems.map((item) => {
      const qtyDec = D(item.quantity);
      const costDec = D(item.costPrice);
      const totalDec = qtyDec.times(costDec);

      const product = item.purchaseOrderItem?.product || item.product;
      const unitName = product?.unit?.name || product?.template?.unit?.name || 'N/A';

      return {
        id: item.id,
        productId: item.productId,
        productName: product?.name || 'N/A',
        quantity: Number(qtyDec),
        unitName,
        costPrice: Number(costDec),
        totalCost: Number(totalDec),
      };
    });

    const supplierName = receipt.purchaseOrder?.supplier?.name || receipt.supplier?.name || 'N/A';

    // Prefer stored total if exists
    const computedTotal = items.reduce((acc, x) => acc.plus(D(x.totalCost)), new Prisma.Decimal(0));
    const effectiveTotal = receipt.totalAmount != null ? D(receipt.totalAmount) : computedTotal;

    return res.status(200).json({
      message: 'Successfully fetched purchase receipt report detail.',
      receipt: {
        receiptId: receipt.id,
        receiptCode: receipt.code,
        receiptDate: receipt.receivedAt,
        receiptStatus: receipt.statusReceipt,
        paymentStatus: receipt.statusPayment,
        poCode: receipt.purchaseOrder?.code || null,
        supplierName,
        branchName: receipt.branch?.name || 'N/A',
        totalAmount: Number(effectiveTotal),
        paidAmount: Number(D(receipt.paidAmount)),
      },
      items,
      summary: {
        itemCount: items.length,
        totalAmount: Number(effectiveTotal),
      },
    });
  } catch (error) {
    console.error('Error fetching purchase receipt report detail:', error);
    return res.status(500).json({
      message: 'An error occurred while fetching the purchase receipt report detail.',
      error: error?.message || String(error),
    });
  }
};

// ✅ Improve summary semantics in line-level endpoint (keep backward compatibility)
// - totalItems = number of rows
// - totalQty = sum(quantity)
// (Note: FE can keep using totalItems as before)

module.exports = {
  getPurchaseReport,
  getPurchaseReceiptReport,
  getPurchaseReceiptReportDetail,
};

