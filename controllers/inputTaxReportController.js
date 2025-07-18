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
        branch: true,
        purchaseOrder: {
          include: {
            supplier: true,
          },
        },
        items: true,
      },
      orderBy: {
        supplierTaxInvoiceDate: 'asc',
      },
    });

    // 5. จัดรูปแบบข้อมูลให้ตรงตามรายงานภาษีซื้อ
    const formattedData = receipts.map(receipt => {
      // ✨ FIXED: ทำให้การคำนวณรัดกุมขึ้น
      const totalAmount = receipt.items?.reduce((sum, item) => {
        return sum + ((item.quantity || 0) * (item.costPrice || 0));
      }, 0) || 0;

      const vatRate = receipt.vatRate || 7;
      const vatAmount = (totalAmount * vatRate) / 100;
      const grandTotal = totalAmount + vatAmount;

      // ✨ FIXED: ใช้ Optional Chaining (?.) เพื่อป้องกัน Error กรณีข้อมูล relation เป็น null
      return {
        id: receipt.id,
        supplierTaxInvoiceDate: receipt.supplierTaxInvoiceDate,
        supplierTaxInvoiceNumber: receipt.supplierTaxInvoiceNumber,
        supplierName: receipt.purchaseOrder?.supplier?.name || 'N/A',
        supplierTaxId: receipt.purchaseOrder?.supplier?.taxId || 'N/A',
        branchName: receipt.branch?.name || 'N/A',
        totalAmount: totalAmount,
        vatAmount: vatAmount,
        grandTotal: grandTotal,
      };
    });

    // 6. คำนวณยอดสรุปของรายงาน
    const summary = {
      totalAmount: formattedData.reduce((sum, item) => sum + item.totalAmount, 0),
      vatAmount: formattedData.reduce((sum, item) => sum + item.vatAmount, 0),
      grandTotal: formattedData.reduce((sum, item) => sum + item.grandTotal, 0),
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
