const { prisma, Prisma } = require('../../../../../lib/prisma');

const toLocalRange = (dateStr, tz = '+07:00') => {
  if (!dateStr) return {};
  const start = new Date(`${dateStr}T00:00:00.000${tz}`);
  const end = new Date(`${dateStr}T23:59:59.999${tz}`);
  return { start, end };
};

const searchPrintablePayments = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ message: 'unauthorized' });

    const { keyword = '', fromDate, toDate, limit: limitRaw } = req.query;
    const limitParsed = parseInt(limitRaw, 10);
    const limit = Math.min(Math.max(limitParsed || 100, 1), 500);
    const fromRange = fromDate ? toLocalRange(fromDate) : null;
    const toRange = toDate ? toLocalRange(toDate) : null;

    const where = {
      branchId,
      isCancelled: false,
      ...(keyword
        ? {
            OR: [
              { code: { contains: keyword, mode: 'insensitive' } },
              { combinedDocumentCode: { contains: keyword, mode: 'insensitive' } },
              { note: { contains: keyword, mode: 'insensitive' } },
              { sale: { is: { code: { contains: keyword, mode: 'insensitive' } } } },
              { sale: { is: { customer: { name: { contains: keyword, mode: 'insensitive' } } } } },
              { sale: { is: { customer: { companyName: { contains: keyword, mode: 'insensitive' } } } } },
              { sale: { is: { customer: { phone: { contains: keyword, mode: 'insensitive' } } } } },
            ],
          }
        : {}),
      sale: {
        is: {
          status: { not: 'CANCELLED' },
          branchId,
        },
      },
      ...(fromRange || toRange
        ? {
            receivedAt: {
              ...(fromRange ? { gte: fromRange.start } : {}),
              ...(toRange ? { lte: toRange.end } : {}),
            },
          }
        : {}),
    };

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take: limit,
      include: {
        items: true,
        sale: {
          include: {
            branch: true,
            customer: true,
            items: {
              include: {
                stockItem: {
                  include: {
                    product: {
                      select: {
                        name: true,
                        unit: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        employeeProfile: true,
      },
    });

    const result = payments.map((payment) => {
      const total = payment.items.reduce(
        (sum, item) => sum.add(item.amount || 0),
        new Prisma.Decimal(0),
      );
      return { ...payment, amount: Number(total.toFixed(2)) };
    });

    return res.json(result);
  } catch (error) {
    console.error('❌ [searchPrintablePayments] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถโหลดข้อมูลใบเสร็จได้' });
  }
};

module.exports = {
  searchPrintablePayments,
};
