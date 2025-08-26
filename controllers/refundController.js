// controllers/refundController.js
const { prisma, Prisma } = require('../lib/prisma');
const dayjs = require('dayjs');

const D = (v) => (v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v ?? 0));
const toNum = (v) => (v && typeof v.toNumber === 'function' ? v.toNumber() : Number(v || 0));

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
    select: { amount: true, deducted: true },
  });

  const refundedAmountDec = transactions.reduce(
    (sum, t) => sum.plus(D(t.amount)),
    new Prisma.Decimal(0)
  );
  const deductedAmountDec = transactions.reduce(
    (sum, t) => sum.plus(D(t.deducted)),
    new Prisma.Decimal(0)
  );
  const totalDec = refundedAmountDec.plus(deductedAmountDec);

  const saleReturn = await prisma.saleReturn.findUnique({
    where: { id: saleReturnId },
    include: { items: true },
  });

  if (!saleReturn) return;

  const totalItemRefundDec = saleReturn.items.reduce(
    (sum, item) => sum.plus(D(item.refundAmount)),
    new Prisma.Decimal(0)
  );

  const isFullyRefunded = totalDec.gte(totalItemRefundDec);
  const status = isFullyRefunded ? 'REFUNDED' : 'PARTIAL';

  await prisma.saleReturn.update({
    where: { id: saleReturnId },
    data: {
      refundedAmount: refundedAmountDec,
      deductedAmount: deductedAmountDec,
      isFullyRefunded,
      status,
    },
  });
};

const createRefundTransaction = async (req, res) => {
  try {
    const { saleReturnId, amount, method, note, deducted } = req.body;
    const branchId = Number(req.user?.branchId);
    const employeeId = Number(req.user?.employeeId);

    if (!saleReturnId || !amount || !method) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
    }

    const saleReturn = await prisma.saleReturn.findFirst({
      where: { id: Number(saleReturnId), branchId },
    });

    if (!saleReturn) {
      return res.status(404).json({ message: 'ไม่พบใบคืนสินค้านี้ในสาขาของคุณ' });
    }

    const refund = await prisma.refundTransaction.create({
      data: {
        saleReturnId: saleReturn.id,
        amount: D(amount),
        deducted: D(deducted || 0),
        method,
        note: note || '',
        refundedByEmployeeId: employeeId,
        branchId,
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
  updateRefundSummary,
};
