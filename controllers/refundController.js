// controllers/refundController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dayjs = require('dayjs');

const generateRefundCode = async (branchId) => {
  const paddedBranch = String(branchId).padStart(2, '0');
  const now = dayjs();
  const prefix = `RT-${paddedBranch}${now.format('YYMM')}`;

  const count = await prisma.saleReturn.count({
    where: {
      branchId: Number(branchId),
      createdAt: {
        gte: now.startOf('month').toDate(),
        lt: now.endOf('month').toDate(),
      },
    },
  });

  const running = String(count + 1).padStart(4, '0');
  return `${prefix}-${running}`;
};

const updateRefundSummary = async (saleReturnId) => {
  const transactions = await prisma.refundTransaction.findMany({
    where: { saleReturnId },
    select: { amount: true, deducted: true }
  });

  const refundedAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
  const deductedAmount = transactions.reduce((sum, t) => sum + t.deducted, 0);
  const total = refundedAmount + deductedAmount;

  const saleReturn = await prisma.saleReturn.findUnique({
    where: { id: saleReturnId },
    include: { items: true },
  });

  const totalItemRefund = saleReturn.items.reduce((sum, item) => sum + item.refundAmount, 0);
  const isFullyRefunded = total >= totalItemRefund;
  const status = isFullyRefunded ? 'REFUNDED' : 'PARTIAL';

  await prisma.saleReturn.update({
    where: { id: saleReturnId },
    data: {
      refundedAmount,
      deductedAmount,
      isFullyRefunded,
      status,
    },
  });
};

const createRefundTransaction = async (req, res) => {
  try {
    const { saleReturnId, amount, method, note, deducted } = req.body;
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
        deducted: parseFloat(deducted || 0),
        method,
        note: note || '',
        refundedByEmployeeId: employeeId,
        branchId: branchId,
      },
    });

    await updateRefundSummary(saleReturn.id);

    return res.status(201).json({ message: 'บันทึกการคืนเงินเรียบร้อย', refund });
  } catch (error) {
    console.error('❌ [createRefundTransaction] error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการคืนเงิน' });
  }
};

module.exports = {
  createRefundTransaction,
  generateRefundCode,
};
