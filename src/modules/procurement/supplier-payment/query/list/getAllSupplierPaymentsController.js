const { prisma } = require('../../../../../../lib/prisma');

const getAllSupplierPayments = async (req, res) => {
  try {
    const branchId = req.user.branchId;

    const payments = await prisma.supplierPayment.findMany({
      where: { branchId },
      orderBy: { paidAt: 'desc' },
      include: {
        supplier: true,
        employee: true,
        supplierPaymentReceipts: {
          include: {
            receipt: true,
          },
        },
      },
    });

    console.log('getAllSupplierPayments payments : ', payments);
    return res.json(payments);
  } catch (err) {
    console.error('❌ [getAllSupplierPayments] error:', err);
    return res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลการชำระเงินได้' });
  }
};

module.exports = { getAllSupplierPayments };
