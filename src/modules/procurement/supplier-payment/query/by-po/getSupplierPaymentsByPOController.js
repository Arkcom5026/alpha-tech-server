const { prisma } = require('../../../../../../lib/prisma');

const getSupplierPaymentsByPO = async (req, res) => {
  try {
    const poId = parseInt(req.params.poId, 10);
    const branchId = req.user.branchId;

    const payments = await prisma.supplierPaymentPO.findMany({
      where: {
        purchaseOrderId: poId,
        supplierPayment: {
          branchId,
        },
      },
      orderBy: {
        supplierPayment: {
          paymentDate: 'asc',
        },
      },
      include: {
        supplierPayment: {
          include: {
            createdBy: true,
          },
        },
      },
    });

    return res.json(payments);
  } catch (err) {
    console.error('❌ [getSupplierPaymentsByPO] error:', err);
    return res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลการชำระของ PO นี้ได้' });
  }
};

module.exports = { getSupplierPaymentsByPO };
