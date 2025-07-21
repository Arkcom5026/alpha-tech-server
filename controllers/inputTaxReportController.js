// src/controllers/inputTaxReportController.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();


const getInputTaxReport = async (req, res) => {
  try {

    const branchId = req.user?.branchId;
    if (!branchId) {
      return res.status(403).json({ message: 'ไม่สามารถระบุสาขาของผู้ใช้ได้' });
    }

    const { month, year } = req.query;
    if (!month || !year) {
    return res.status(400).json({ message: 'กรุณาระบุเดือนและปีภาษี' });
  }

    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);


    const receipts = await prisma.purchaseOrderReceipt.findMany({
      where: {
        branchId: parseInt(branchId),

        supplierTaxInvoiceDate: {
          gte: startDate,
          lte: endDate,
        },

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

    const formattedData = receipts.map(receipt => {

      const totalAmount = receipt.items?.reduce((sum, item) => {
        return sum + ((item.quantity || 0) * (item.costPrice || 0));
      }, 0) || 0;

      const vatRate = receipt.vatRate || 7;
      const vatAmount = (totalAmount * vatRate) / 100;
      const grandTotal = totalAmount + vatAmount;

      return {
        id: receipt.id,
        date: receipt.supplierTaxInvoiceDate,
        poNumber: receipt.purchaseOrder?.orderNumber || 'N/A',
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

    const summary = {
      totalAmount: formattedData.reduce((sum, item) => sum + item.totalAmount, 0),
      vatAmount: formattedData.reduce((sum, item) => sum + item.vatAmount, 0),
      grandTotal: formattedData.reduce((sum, item) => sum + item.grandTotal, 0),
    };

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

module.exports = {
  getInputTaxReport,

}
