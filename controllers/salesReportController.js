// salesReportController.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getSalesTaxReport = async (req, res) => {
  try {
    const branchId = req.user?.branchId;
    const { startDate, endDate } = req.query;

    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);

    if (isNaN(parsedStart) || isNaN(parsedEnd)) {
      return res.status(400).json({ message: 'วันที่ไม่ถูกต้อง' });
    }

    console.log('📌 [getSalesTaxReport] startDate:', parsedStart, 'endDate:', parsedEnd);

    const sales = await prisma.sale.findMany({
      where: {
        soldAt: {
          gte: parsedStart,
          lte: parsedEnd,
        },
        branchId: Number(branchId),
        isTaxInvoice: true,
      },
      orderBy: { soldAt: 'asc' },
      include: { customer: true },
    });

    const returns = await prisma.saleReturn.findMany({
      where: {
        returnedAt: {
          gte: parsedStart,
          lte: parsedEnd,
        },
        sale: {
          branchId: Number(branchId),
          isTaxInvoice: true,
        },
      },
      orderBy: { returnedAt: 'asc' },
      include: {
        sale: {
          include: {
            customer: true,
          },
        },
      },
    });

    const saleResults = sales.map((sale) => {
      const baseAmount = +(sale.totalBeforeDiscount + sale.totalDiscount).toFixed(2);
      const vatAmount = +(sale.vat).toFixed(2);
      return {
        date: sale.soldAt,
        taxInvoiceNumber: sale.taxInvoiceNumber || sale.code,
        customerName: sale.customer?.name || '-',
        taxId: sale.customer?.taxId || '',
        baseAmount,
        vatAmount,
        totalAmount: sale.totalAmount,
        type: 'sale',
      };
    });

    const returnResults = returns.map((ret) => {
      const baseAmount = +(ret.totalBeforeDiscount + ret.totalDiscount).toFixed(2);
      const vatAmount = +(ret.vat).toFixed(2);
      return {
        date: ret.returnedAt,
        taxInvoiceNumber: ret.taxInvoiceNumber || ret.code,
        customerName: ret.sale?.customer?.name || '-',
        taxId: ret.sale?.customer?.taxId || '',
        baseAmount,
        vatAmount,
        totalAmount: ret.totalAmount,
        type: 'return',
      };
    });

    return res.status(200).json({ sales: saleResults, returns: returnResults });
  } catch (error) {
    console.error('❌ [getSalesTaxReport] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถดึงรายงานภาษีขายได้' });
  }
};

module.exports = {
  getSalesTaxReport,
};
