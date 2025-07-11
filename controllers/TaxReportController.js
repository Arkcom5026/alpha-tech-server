// controllers/TaxReportController.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * @desc    Get Sales Tax Report (including Credit Notes) for the user's branch
 * @route   GET /api/reports/sales-tax
 * @access  Private (Requires authentication)
 * @query   startDate (ISO 8601 Format)
 * @query   endDate (ISO 8601 Format)
 */
const getSalesTaxReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    // ✅ 1. ดึง branchId จากข้อมูล user ที่ผ่าน middleware authentication มา
    const branchId = req.user?.branchId;

    // --- 1. ตรวจสอบ Input ---
    if (!branchId) {
      return res.status(403).json({
        success: false,
        message: 'ไม่สามารถระบุสาขาของผู้ใช้ได้'
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุวันที่เริ่มต้น (startDate) และวันที่สิ้นสุด (endDate)'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

 

    // --- 2. ดึงข้อมูลการขาย (ใบกำกับภาษี) ---
    const salesInvoices = await prisma.sale.findMany({
      where: {
        branchId: branchId, // ✅ กรองข้อมูลตามสาขา
        isTaxInvoice: true,
        soldAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        customer: {
          select: {
            name: true,
            taxId: true,
          },
        },
      },
      orderBy: {
        soldAt: 'asc',
      },
    });

    // --- 3. ดึงข้อมูลการคืนสินค้า (ใบลดหนี้) ---
    const creditNotes = await prisma.saleReturn.findMany({
      where: {
        returnedAt: {
          gte: start,
          lte: end,
        },
        // ✅ กรองข้อมูลตามสาขาจากบิลขายที่อ้างอิง
        sale: {
          isTaxInvoice: true,
          branchId: branchId, 
        }
      },
      include: {
        sale: {
          select: {
            code: true,
            customer: {
              select: {
                name: true,
                taxId: true,
              }
            }
          }
        }
      },
      orderBy: {
        returnedAt: 'asc'
      }
    });

    // --- 4. จัดรูปแบบข้อมูลเพื่อส่งกลับ ---
    const formattedSales = salesInvoices.map(sale => ({
      type: 'SALE',
      date: sale.soldAt,
      invoiceNumber: sale.code,
      customerName: sale.customer?.name || 'ลูกค้าเงินสด',
      customerTaxId: sale.customer?.taxId || '-',
      value: sale.totalAmount - sale.vat,
      vat: sale.vat,
      totalAmount: sale.totalAmount,
    }));

    const formattedReturns = creditNotes.map(cn => ({
      type: 'RETURN',
      date: cn.returnedAt,
      creditNoteNumber: cn.code,
      originalInvoiceNumber: cn.sale.code,
      customerName: cn.sale.customer?.name || 'ลูกค้าเงินสด',
      customerTaxId: cn.sale.customer?.taxId || '-',
      value: -(cn.totalRefund / (1 + (salesInvoices.find(s => s.id === cn.saleId)?.vatRate || 7) / 100)),
      vat: -(cn.totalRefund - (cn.totalRefund / (1 + (salesInvoices.find(s => s.id === cn.saleId)?.vatRate || 7) / 100))),
      totalAmount: -cn.totalRefund,
    }));

    res.status(200).json({
      success: true,
      message: 'ดึงข้อมูลรายงานภาษีขายสำเร็จ',
      data: {
        sales: formattedSales,
        returns: formattedReturns,
      },
    });
  } catch (error) {
    console.error('Error getting sales tax report:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
  }
};






/**
 * @desc    Get Purchase Tax Report for the user's branch
 * @route   GET /api/reports/purchase-tax
 * @access  Private (Requires authentication)
 * @query   startDate (ISO 8601 Format)
 * @query   endDate (ISO 8601 Format)
 */
const getPurchaseTaxReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    // ✅ 1. ดึง branchId จากข้อมูล user
    const branchId = req.user?.branchId;

    // --- 1. ตรวจสอบ Input ---
    if (!branchId) {
      return res.status(403).json({
        success: false,
        message: 'ไม่สามารถระบุสาขาของผู้ใช้ได้'
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุวันที่เริ่มต้น (startDate) และวันที่สิ้นสุด (endDate)'
      });
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);

    // --- 2. ดึงข้อมูลใบรับของที่มีใบกำกับภาษี ---
    const purchaseReceipts = await prisma.purchaseOrderReceipt.findMany({
      where: {
        branchId: branchId, // ✅ กรองข้อมูลตามสาขา
        supplierTaxInvoiceDate: {
          gte: start,
          lte: end,
        },
        supplierTaxInvoiceNumber: {
          not: null,
          not: '',
        },
      },
      include: {
        purchaseOrder: {
          include: {
            supplier: {
              select: {
                name: true,
                taxId: true,
                taxBranchCode: true,
              },
            },
          },
        },
      },
      orderBy: {
        supplierTaxInvoiceDate: 'asc',
      },
    });

    // --- 3. จัดรูปแบบข้อมูลเพื่อส่งกลับ ---
    const formattedPurchases = purchaseReceipts.map(receipt => {
        const vatRate = receipt.vatRate || 7;
        const totalAmount = receipt.totalAmount || 0;
        
        const vat = totalAmount * (vatRate / (100 + vatRate));
        const value = totalAmount - vat;
        return {
            date: receipt.supplierTaxInvoiceDate,
            invoiceNumber: receipt.supplierTaxInvoiceNumber,
            supplierName: receipt.purchaseOrder.supplier.name,
            supplierTaxId: receipt.purchaseOrder.supplier.taxId,
            supplierBranchCode: receipt.purchaseOrder.supplier.taxBranchCode,
            value: value,
            vat: vat,
            totalAmount: totalAmount,
        }
    });

    res.status(200).json({
      success: true,
      message: 'ดึงข้อมูลรายงานภาษีซื้อสำเร็จ',
      data: formattedPurchases,
    });
  } catch (error) {
    console.error('Error getting purchase tax report:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
  }
};

module.exports = {
  getSalesTaxReport,
  getPurchaseTaxReport,
};
