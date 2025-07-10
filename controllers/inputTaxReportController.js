// src/controllers/inputTaxReportController.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Controller สำหรับดึงข้อมูลรายงานภาษีซื้อ
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
exports.getInputTaxReport = async (req, res) => {
  try {
    // 1. ดึง branchId จาก token ของผู้ใช้ที่ login
    const branchId = req.user?.branchId;
    if (!branchId) {
      return res.status(403).json({ message: 'ไม่สามารถระบุสาขาของผู้ใช้ได้' });
    }

    // 2. ดึงเดือนและปีภาษีจาก Query Parameters
    const { taxMonth, taxYear } = req.query;
    if (!taxMonth || !taxYear) {
      return res.status(400).json({ message: 'กรุณาระบุเดือนและปีภาษี' });
    }

    // 3. คำนวณช่วงวันที่ของเดือนภาษีที่ต้องการ
    const startDate = new Date(parseInt(taxYear), parseInt(taxMonth) - 1, 1);
    const endDate = new Date(parseInt(taxYear), parseInt(taxMonth), 0, 23, 59, 59, 999);

    // 4. Query ข้อมูลจาก PurchaseOrderReceipt เป็นหลัก
    const receipts = await prisma.purchaseOrderReceipt.findMany({
      where: {
        branchId: parseInt(branchId),
        // กรองจากวันที่บนใบกำกับภาษีของผู้ขาย
        supplierTaxInvoiceDate: {
          gte: startDate,
          lte: endDate,
        },
        // ดึงมาเฉพาะรายการที่มีเลขที่ใบกำกับภาษี
        supplierTaxInvoiceNumber: {
          not: null,
        },
      },
      include: {
        // ดึงข้อมูลที่เกี่ยวข้องมาด้วย
        purchaseOrder: {
          include: {
            supplier: true, // ข้อมูลผู้ขาย
          },
        },
        items: true, // รายการสินค้าในใบรับเพื่อคำนวณยอด
      },
      orderBy: {
        supplierTaxInvoiceDate: 'asc', // เรียงตามวันที่ในใบกำกับภาษี
      },
    });

    // 5. จัดรูปแบบข้อมูลให้ตรงตามรายงานภาษีซื้อ
    const formattedData = receipts.map(receipt => {
      // คำนวณยอดรวมของใบรับนั้นๆ
      const totalBaseAmount = receipt.items.reduce((sum, item) => {
        return sum + (item.quantity * item.costPrice);
      }, 0);

      // คำนวณภาษี (ใช้ vatRate จากใบรับ หรือ 7% เป็นค่า default)
      const vatRate = receipt.vatRate || 7;
      const vatAmount = (totalBaseAmount * vatRate) / 100;

      return {
        id: receipt.id,
        taxInvoiceDate: receipt.supplierTaxInvoiceDate,
        taxInvoiceNumber: receipt.supplierTaxInvoiceNumber,
        supplierName: receipt.purchaseOrder.supplier.name,
        supplierTaxId: receipt.purchaseOrder.supplier.taxId,
        supplierTaxBranchCode: receipt.purchaseOrder.supplier.taxBranchCode,
        baseAmount: totalBaseAmount,
        vatAmount: vatAmount,
      };
    });

    // 6. คำนวณยอดสรุปของรายงาน
    const summary = {
      totalBaseAmount: formattedData.reduce((sum, item) => sum + item.baseAmount, 0),
      totalVatAmount: formattedData.reduce((sum, item) => sum + item.vatAmount, 0),
    };

    // 7. ส่งข้อมูลกลับไปให้ Frontend
    res.status(200).json({
      message: 'Successfully fetched input tax report.',
      data: formattedData,
      summary: summary,
    });

  } catch (error) {
    console.error("Error fetching input tax report:", error);
    res.status(500).json({
      message: "An error occurred while fetching the input tax report.",
      error: error.message,
    });
  }
};


