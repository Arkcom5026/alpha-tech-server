const { prisma } = require('../../../../../../lib/prisma');

const getAdvancePaymentsBySupplier = async (req, res) => {
  try {
    const { supplierId } = req.query;

    if (!supplierId) {
      return res.status(400).json({ message: 'supplierId is required' });
    }

    const payments = await prisma.supplierPayment.findMany({
      where: {
        supplierId: parseInt(supplierId, 10),
        paymentType: 'ADVANCE',
      },
      orderBy: { paidAt: 'desc' },
      select: {
        id: true,
        code: true,
        paidAt: true,
        paymentType: true,
        amount: true,
        method: true,
        note: true,
        supplierId: true,
        employee: {
          select: {
            name: true,
          },
        },
      },
    });

    return res.json(payments);
  } catch (err) {
    console.error('❌ getAdvancePaymentsBySupplier error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = { getAdvancePaymentsBySupplier };
