const { prisma } = require('../../../../../lib/prisma');
const { toDecimal } = require('../shared/refundMoney');
const { updateRefundSummary } = require('../services/updateRefundSummaryService');

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
        amount: toDecimal(amount),
        deducted: toDecimal(deducted || 0),
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
};
