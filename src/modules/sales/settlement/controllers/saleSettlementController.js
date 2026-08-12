const { prisma } = require('../../../../../lib/prisma');
const { projectSalePaymentStatus } = require('../../completion/services/salePaymentPostingService');
const {
  resolveCanonicalTotalAmount,
} = require('../../shared/saleLegacyProjection');

const createSettlementError = ({ message, status, code, detail }) =>
  Object.assign(new Error(message), {
    status,
    code,
    detail,
  });

const sendSettlementError = (res, error) => {
  const status = Number(error?.status);
  if (!Number.isInteger(status) || status < 400 || status > 499) return false;

  return res.status(status).json({
    message: error?.message || 'ไม่สามารถปิดบิลได้',
    ...(error?.code ? { code: error.code } : {}),
    ...(error?.detail ? { detail: error.detail } : {}),
  });
};

const markSaleAsPaid = async (req, res) => {
  const saleId = parseInt(req.params.id, 10);
  const branchId = Number(req.user?.branchId);

  if (!saleId || Number.isNaN(saleId)) return res.status(400).json({ message: 'Sale ID ไม่ถูกต้อง' });
  if (!branchId || Number.isNaN(branchId)) return res.status(401).json({ message: 'unauthorized' });

  try {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true },
    });

    if (!sale || Number(sale.branchId) !== branchId) {
      return res.status(404).json({ message: 'ไม่พบรายการขายนี้ในสาขาของคุณ' });
    }

    const canonicalTotalAmount = resolveCanonicalTotalAmount(sale);
    if (sale.paid && Number(sale.paidAmount || 0) + 0.001 >= canonicalTotalAmount) {
      return res.status(200).json({ success: true });
    }

    await prisma.$transaction(async (tx) => {
      // This is the sole payment truth for closing a sale: normal Payment evidence plus
      // active Customer Money Settlement evidence under the shared sale-level lock.
      const projection = await projectSalePaymentStatus(tx, saleId);
      const projectedPaidAmount = Number(projection.paidAmount || 0);
      const projectedTotalAmount = Number(projection.totalAmount || canonicalTotalAmount);
      const balanceAmount = Math.max(0, Number((projectedTotalAmount - projectedPaidAmount).toFixed(2)));

      if (!projection.paid) {
        throw createSettlementError({
          message: 'ยอดชำระยังไม่ครบ ไม่สามารถปิดบิลได้',
          status: 409,
          code: 'PAYMENT_EVIDENCE_INSUFFICIENT',
          detail: {
            totalAmount: projectedTotalAmount,
            paidAmount: projectedPaidAmount,
            balanceAmount,
          },
        });
      }

      await tx.sale.update({
        where: { id: saleId },
        data: {
          soldAt: sale.soldAt || new Date(),
          status: 'COMPLETED',
        },
      });

      const stockItemIds = (sale.items || []).map((it) => it.stockItemId).filter(Boolean);
      if (stockItemIds.length > 0) {
        await tx.stockItem.updateMany({
          where: { id: { in: stockItemIds }, status: { not: 'SOLD' } },
          data: { status: 'SOLD', soldAt: new Date() },
        });
      }
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    if (sendSettlementError(res, error)) return;

    console.error('❌ [markSaleAsPaid]', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดขณะปิดบิล' });
  }
};

module.exports = {
  createSettlementError,
  sendSettlementError,
  markSaleAsPaid,
};
