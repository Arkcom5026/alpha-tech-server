const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createPayment = async (req, res) => {
  try {
    const { saleId, paymentMethod, amount, note } = req.body;
    const user = req.user; // ต้องมี middleware verifyToken ก่อนถึง controller นี้

    if (!saleId || !paymentMethod || !amount) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
    }

    const payment = await prisma.payment.create({
      data: {
        saleId,
        paymentMethod,
        amount: parseFloat(amount),
        note,
        receivedAt: new Date(),
        employeeProfileId: user.employeeProfileId,
        branchId: user.branchId,
      },
    });

    return res.status(201).json(payment);
  } catch (error) {
    console.error('❌ [createPayment] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถบันทึกการชำระเงินได้' });
  }
};

module.exports = {
  createPayment,
};
