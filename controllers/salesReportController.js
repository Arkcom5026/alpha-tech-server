// salesReportController.js — Prisma singleton, Decimal-safe, BRANCH_SCOPE_ENFORCED

const { prisma, Prisma } = require('../lib/prisma');

// Helpers
const D = (v) => (v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v ?? 0));
const toNum = (v) => (v && typeof v.toNumber === 'function' ? v.toNumber() : Number(v ?? 0));
const startOfDay = (d) => new Date(new Date(d).setHours(0, 0, 0, 0));
const endOfDay = (d) => new Date(new Date(d).setHours(23, 59, 59, 999));

const getSalesTaxReport = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    const { startDate, endDate } = req.query || {};

    if (!branchId) {
      return res.status(403).json({ message: 'ไม่พบสิทธิ์สาขาของผู้ใช้ (branchId)' });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'กรุณาระบุช่วงวันที่ (startDate, endDate)' });
    }

    const parsedStart = startOfDay(startDate);
    const parsedEnd = endOfDay(endDate);

    if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
      return res.status(400).json({ message: 'วันที่ไม่ถูกต้อง' });
    }

    console.log('📌 [getSalesTaxReport]', { branchId, parsedStart, parsedEnd });

    // ✅ ดึงเฉพาะใบกำกับภาษีขายของสาขานี้
    const sales = await prisma.sale.findMany({
      where: {
        branchId,
        isTaxInvoice: true,
        soldAt: { gte: parsedStart, lte: parsedEnd },
      },
      orderBy: { soldAt: 'asc' },
      include: { customer: true },
    });

    // ✅ ดึงใบคืนที่อ้างอิงใบกำกับภาษีขาย (ในช่วงเวลาเดียวกัน)
    const returns = await prisma.saleReturn.findMany({
      where: {
        returnedAt: { gte: parsedStart, lte: parsedEnd },
        sale: { branchId, isTaxInvoice: true },
      },
      orderBy: { returnedAt: 'asc' },
      include: { sale: { include: { customer: true } } },
    });

    const saleResults = sales.map((sale) => {
      // หมายเหตุ: baseAmount ยังคงตรรกะเดิมของระบบ (beforeDiscount + discount)
      const baseAmountDec = D(sale.totalBeforeDiscount).plus(D(sale.totalDiscount));
      const vatAmountDec = D(sale.vat);
      const totalAmountDec = D(sale.totalAmount);

      return {
        date: sale.soldAt,
        taxInvoiceNumber: sale.taxInvoiceNumber || sale.code,
        customerName: sale.customer?.name || '-',
        taxId: sale.customer?.taxId || '',
        baseAmount: toNum(baseAmountDec),
        vatAmount: toNum(vatAmountDec),
        totalAmount: toNum(totalAmountDec),
        type: 'sale',
      };
    });

    const returnResults = returns.map((ret) => {
      const baseAmountDec = D(ret.totalBeforeDiscount).plus(D(ret.totalDiscount));
      const vatAmountDec = D(ret.vat);
      const totalAmountDec = D(ret.totalAmount);

      return {
        date: ret.returnedAt,
        taxInvoiceNumber: ret.taxInvoiceNumber || ret.code,
        customerName: ret.sale?.customer?.name || '-',
        taxId: ret.sale?.customer?.taxId || '',
        baseAmount: toNum(baseAmountDec),
        vatAmount: toNum(vatAmountDec),
        totalAmount: toNum(totalAmountDec),
        type: 'return',
      };
    });

    return res.status(200).json({ sales: saleResults, returns: returnResults, period: { start: parsedStart, end: parsedEnd } });
  } catch (error) {
    console.error('❌ [getSalesTaxReport] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถดึงรายงานภาษีขายได้' });
  }
};

module.exports = { getSalesTaxReport };
