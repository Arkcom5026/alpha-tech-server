const { prisma } = require('../../../../../../lib/prisma');

const getSupplierPaymentsBySupplier = async (req, res) => {
  try {
    const branchId = req.user.branchId;
    const supplierId = parseInt(req.params.supplierId, 10);

    if (!supplierId) {
      return res.status(400).json({ error: 'Missing supplierId parameter' });
    }

    const payments = await prisma.supplierPayment.findMany({
      where: {
        branchId,
        supplierId,
      },
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

    return res.json(payments);
  } catch (err) {
    console.error('❌ [getSupplierPaymentsBySupplier] error:', err);
    return res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลการชำระเงินของ Supplier นี้ได้' });
  }
};

module.exports = { getSupplierPaymentsBySupplier };
