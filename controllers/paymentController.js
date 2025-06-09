// controllers/paymentController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const generatePaymentCode = async (branchId) => {
  const paddedBranch = String(branchId).padStart(2, '0');
  const now = new Date();
  const yymm = `${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getFullYear().toString().slice(2)}`;

  const count = await prisma.payment.count({
    where: {
      branchId,
      createdAt: {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
        lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      },
    },
  });

  const sequence = String(count + 1).padStart(4, '0');
  return `PMT-${paddedBranch}${yymm}-${sequence}`;
};


const createPayments = async (req, res) => {
  try {
    const payments = req.body;

    const branchId = req.user?.branchId;
    const employeeId = req.user?.employeeId;

    if (!Array.isArray(payments) || payments.length === 0) {
      return res.status(400).json({ message: 'ไม่มีข้อมูลรายการชำระเงิน' });
    }

    const paymentData = [];
    for (const item of payments) {
      const code = await generatePaymentCode(branchId);
      paymentData.push({
        code,
        saleId: parseInt(item.saleId),
        paymentMethod: item.paymentMethod,
        amount: parseFloat(item.amount),
        note: item.note || null,
        slipImage: item.slipImage || null,
        cardRef: item.cardRef || null,
        govImage: item.govImage || null,
        receivedAt: new Date(),
        employeeProfileId: employeeId,
        branchId: branchId,
      });
    }

    const created = await Promise.all(
      paymentData.map((item) =>
        prisma.payment.create({
          data: item,
        })
      )
    );

    return res.status(201).json({ message: 'บันทึกข้อมูลการชำระเงินแล้ว', count: created.length });
  } catch (error) {
    console.error('❌ [createPayments] error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
  }
};





const searchPrintablePayments = async (req, res) => {
  try {
    const branchId = req.user.branchId;
    const { keyword } = req.query;

    const payments = await prisma.payment.findMany({
      where: {
        branchId,
        ...(keyword && {
          OR: [
            {
              sale: {
                customer: {
                  name: {
                    contains: keyword,
                    mode: 'insensitive',
                  },
                },
              },
            },
            {
              sale: {
                customer: {
                  phone: {
                    contains: keyword,
                    mode: 'insensitive',
                  },
                },
              },
            },
            {
              sale: {
                code: {
                  contains: keyword,
                  mode: 'insensitive',
                },
              },
            },
          ],
        }),
      },
      orderBy: { receivedAt: 'desc' },
      include: {
        sale: {
        include: {
          branch: true,
            customer: true,
            items: {
              include: {
                stockItem: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        },
        employeeProfile: true,
      },
    });

    console.log('searchPrintablePayments :', payments);

    res.json(payments);
  } catch (error) {
    console.error('❌ [searchPrintablePayments] error:', error);
    res.status(500).json({ message: 'ไม่สามารถโหลดข้อมูลใบเสร็จได้' });
  }
};








const cancelPayment = async (req, res) => {
  try {
    const { paymentId, note } = req.body;
    const branchId = req.user.branchId;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment || payment.branchId !== branchId) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลการชำระเงินในสาขานี้' });
    }

    if (payment.isCancelled) {
      return res.status(400).json({ message: 'รายการนี้ถูกยกเลิกแล้ว' });
    }

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        isCancelled: true,
        cancelNote: note || null,
        cancelledAt: new Date(),
      },
    });

    res.json({ message: 'ยกเลิกรายการชำระเงินเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('❌ [cancelPayment] error:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการยกเลิก' });
  }
};

module.exports = {
  createPayments,
  searchPrintablePayments,
  cancelPayment,
};
