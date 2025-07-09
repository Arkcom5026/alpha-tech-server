// src/controllers/purchaseReportController.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Controller สำหรับดึงข้อมูลรายงานการจัดซื้อ
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
exports.getPurchaseReport = async (req, res) => {
  try {
    // ✅ 1. ดึง branchId จากข้อมูล user ใน token
    const branchId = req.user?.branchId;
    if (!branchId) {
      return res.status(403).json({ message: 'ไม่สามารถระบุสาขาของผู้ใช้ได้' });
    }

    // ✅ 2. ดึงค่า Filter จาก Query Parameters (เพิ่ม status)
    const { dateFrom, dateTo, supplierId, productId, status } = req.query;

    // 3. สร้างเงื่อนไข (where clause) สำหรับ Prisma Query
    const whereClause = {
      // กรองจากวันที่ในใบรับสินค้า (PurchaseOrderReceipt)
      receipt: {
        receivedAt: {
          gte: dateFrom ? new Date(dateFrom) : undefined, // gte = มากกว่าหรือเท่ากับ
          lte: dateTo ? new Date(new Date(dateTo).setHours(23, 59, 59, 999)) : undefined, // lte = น้อยกว่าหรือเท่ากับ (ปรับเป็นสิ้นสุดของวัน)
        },
        // ✅ 4. ใช้ branchId ที่ได้จาก token ในการกรองข้อมูลเสมอ
        branchId: parseInt(branchId),
        // กรองจากข้อมูลในใบสั่งซื้อ (PurchaseOrder)
        purchaseOrder: {
          supplierId: supplierId ? parseInt(supplierId) : undefined,
          // ✨ เพิ่มการกรองตามสถานะ
          status: status ? status : undefined,
        },
      },
      // กรองจาก ID ของสินค้า
      purchaseOrderItem: {
        productId: productId ? parseInt(productId) : undefined,
      },
    };

    // 5. Query ข้อมูลจากฐานข้อมูลโดยใช้ PurchaseOrderReceiptItem เป็นตารางหลัก
    const receiptItems = await prisma.purchaseOrderReceiptItem.findMany({
      where: whereClause,
      include: {
        // ดึงข้อมูลที่เกี่ยวข้องมาด้วยเพื่อใช้แสดงผล
        receipt: {
          include: {
            branch: true, // ชื่อสาขา
            purchaseOrder: {
              include: {
                supplier: true, // ชื่อผู้ขาย
              },
            },
          },
        },
        purchaseOrderItem: {
          include: {
            product: {
              include: {
                template: {
                  include: {
                    unit: true, // ชื่อหน่วยนับ
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        receipt: {
          receivedAt: 'desc', // เรียงจากวันที่รับล่าสุด
        },
      },
    });

    // 6. จัดรูปแบบข้อมูล (Transform) ให้อยู่ในรูปแบบที่ Frontend ใช้งานง่าย
    const formattedData = receiptItems.map(item => ({
      receiptId: item.receipt.id,
      receiptCode: item.receipt.code,
      receiptDate: item.receipt.receivedAt,
      poCode: item.receipt.purchaseOrder.code,
      supplierName: item.receipt.purchaseOrder.supplier.name,
      branchName: item.receipt.branch.name,
      productName: item.purchaseOrderItem.product.name,
      quantity: item.quantity,
      unitName: item.purchaseOrderItem.product.template.unit?.name || 'N/A',
      costPrice: item.costPrice,
      totalCost: item.quantity * item.costPrice,
    }));

    // 7. คำนวณยอดสรุป
    const summary = {
      totalAmount: formattedData.reduce((sum, item) => sum + item.totalCost, 0),
      totalItems: formattedData.reduce((sum, item) => sum + item.quantity, 0),
      uniqueReceipts: new Set(formattedData.map(item => item.receiptCode)).size,
    };

    // 8. ส่งข้อมูลกลับไปให้ Frontend
    res.status(200).json({
      message: 'Successfully fetched purchase report.',
      data: formattedData,
      summary: summary,
    });

  } catch (error) {
    console.error("Error fetching purchase report:", error);
    res.status(500).json({
      message: "An error occurred while fetching the purchase report.",
      error: error.message,
    });
  }
};
