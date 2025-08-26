// src/controllers/inputTaxReportController.js

// ✅ Use shared Prisma singleton + Decimal-safe helpers
const { prisma, Prisma } = require('../lib/prisma');

const D = (v) => (v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v || 0));
const toNum = (v) => (v && typeof v.toNumber === 'function' ? v.toNumber() : Number(v || 0));

const getInputTaxReport = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    if (!branchId) {
      return res.status(403).json({ message: 'ไม่สามารถระบุสาขาของผู้ใช้ได้' });
    }

    const month = Number(req.query?.month);
    const year = Number(req.query?.year);
    if (!month || !year) {
      return res.status(400).json({ message: 'กรุณาระบุเดือนและปีภาษี' });
    }

    // 🗓️ Range: [start, end] = full calendar month
    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // 📄 ดึงเฉพาะใบรับที่มีใบกำกับภาษี + ไม่ใช่ซัพพลายเออร์ระบบ
    const receipts = await prisma.purchaseOrderReceipt.findMany({
      where: {
        branchId,
        supplierTaxInvoiceDate: { gte: startDate, lte: endDate },
        supplierTaxInvoiceNumber: { not: null },
        purchaseOrder: { supplier: { isSystem: false } },
      },
      include: {
        branch: true,
        purchaseOrder: { include: { supplier: true } },
        items: { select: { quantity: true, costPrice: true } },
      },
      orderBy: { supplierTaxInvoiceDate: 'asc' },
    });

    const rows = receipts.map((receipt) => {
      const totalAmountDec = (receipt.items || []).reduce(
        (sum, it) => sum.plus(D(it.costPrice).times(it.quantity || 0)),
        new Prisma.Decimal(0)
      );

      const vatRate = Number(receipt.vatRate || 7);
      const vatAmountDec = totalAmountDec.times(vatRate).div(100);
      const grandTotalDec = totalAmountDec.plus(vatAmountDec);

      return {
        id: receipt.id,
        date: receipt.supplierTaxInvoiceDate,
        poNumber: receipt.purchaseOrder?.code || 'N/A', // ✅ use PO.code
        supplierTaxInvoiceDate: receipt.supplierTaxInvoiceDate,
        supplierTaxInvoiceNumber: receipt.supplierTaxInvoiceNumber,
        supplierName: receipt.purchaseOrder?.supplier?.name || 'N/A',
        supplierTaxId: receipt.purchaseOrder?.supplier?.taxId || 'N/A',
        branchName: receipt.branch?.name || 'N/A',
        totalAmount: toNum(totalAmountDec),
        vatAmount: toNum(vatAmountDec),
        grandTotal: toNum(grandTotalDec),
        vatRate,
      };
    });

    const summary = rows.reduce(
      (acc, r) => {
        acc.totalAmount += r.totalAmount;
        acc.vatAmount += r.vatAmount;
        acc.grandTotal += r.grandTotal;
        return acc;
      },
      { totalAmount: 0, vatAmount: 0, grandTotal: 0 }
    );

    res.status(200).json({
      message: 'Successfully fetched input tax report.',
      data: rows,
      summary,
      period: { month, year, startDate, endDate },
    });
  } catch (error) {
    console.error('Error fetching input tax report:', error);
    res.status(500).json({
      message: 'An error occurred while fetching the input tax report.',
      error: error.message || String(error),
    });
  }
};

module.exports = { getInputTaxReport };
