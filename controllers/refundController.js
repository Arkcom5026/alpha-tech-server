// controllers/refundController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createRefundTransaction = async (req, res) => {
  try {
    const { saleReturnId, amount, method, note } = req.body;
    const branchId = req.user?.branchId;
    const employeeId = req.user?.employeeId;

    if (!saleReturnId || !amount || !method) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
    }

    const saleReturn = await prisma.saleReturn.findFirst({
      where: {
        id: Number(saleReturnId),
        branchId: branchId,
      },
    });

    if (!saleReturn) {
      return res.status(404).json({ message: 'ไม่พบใบคืนสินค้านี้ในสาขาของคุณ' });
    }

    const refund = await prisma.refundTransaction.create({
      data: {
        saleReturnId: saleReturn.id,
        amount: parseFloat(amount),
        method,
        note: note || '',
        refundedByEmployeeId: employeeId,
        branchId: branchId,
      },
    });

    // อัปเดตสถานะของ saleReturn เป็น REFUNDED
    await prisma.saleReturn.update({
      where: { id: saleReturn.id },
      data: {
        status: 'REFUNDED',
        totalRefund: parseFloat(amount),
        refundMethod: method,
      },
    });

    return res.status(201).json({ message: 'บันทึกการคืนเงินเรียบร้อย', refund });
  } catch (error) {
    console.error('❌ [createRefundTransaction] error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการคืนเงิน' });
  }
};

module.exports = {
  createRefundTransaction,
};
