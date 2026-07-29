



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

    // ✅ Reports should never be cached (prevents 304/ETag issues and stale data)
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Surrogate-Control': 'no-store',
    });
    // Defensive: some stacks may still attach validators
    res.removeHeader('ETag');
    res.removeHeader('Last-Modified');

    const q = req.query || {};

    const startDateText = typeof q.startDate === 'string' ? q.startDate.trim() : '';
    const endDateText = typeof q.endDate === 'string' ? q.endDate.trim() : '';

    const parseYMDLocal = (s, endOfDay = false) => {
      const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(s || '').trim());
      if (!m) return null;
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
      return endOfDay
        ? new Date(y, mo - 1, d, 23, 59, 59, 999)
        : new Date(y, mo - 1, d, 0, 0, 0, 0);
    };

    let month = Number(q.month);
    let year = Number(q.year);

    let startDate = null;
    let endDate = null;

    if (startDateText && endDateText) {
      startDate = parseYMDLocal(startDateText, false);
      endDate = parseYMDLocal(endDateText, true);
      if (!startDate || !endDate) {
        return res.status(400).json({ message: 'รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)' });
      }
      if (startDate.getTime() > endDate.getTime()) {
        return res.status(400).json({ message: 'ช่วงวันที่ไม่ถูกต้อง (startDate ต้องไม่มากกว่า endDate)' });
      }
      month = startDate.getMonth() + 1;
      year = startDate.getFullYear();
    } else {
      if (!month || !year) {
        return res.status(400).json({ message: 'กรุณาระบุช่วงวันที่ (startDate/endDate) หรือ เดือนและปีภาษี (month/year)' });
      }
      startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
      endDate = new Date(year, month, 0, 23, 59, 59, 999);
    }

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
      period: {
        month,
        year,
        startDate,
        endDate,
        startDateText: startDateText || undefined,
        endDateText: endDateText || undefined,
      },
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
