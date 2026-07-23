const { prisma, Prisma } = require('../../../../../lib/prisma');
const { projectSalePaymentStatus } = require('../../completion/services/salePaymentPostingService');
const {
  resolveCanonicalTotalAmount,
  round2,
  toNum,
} = require('../../shared/saleLegacyProjection');

const D = (value) =>
  new Prisma.Decimal(typeof value === 'string' ? value : Number(value));

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
    const canonicalTotalDecimal = D(canonicalTotalAmount);

    const agg = await prisma.paymentItem.aggregate({
      _sum: { amount: true },
      where: { payment: { saleId, isCancelled: false } },
    });

    const paidSum = agg._sum.amount || new Prisma.Decimal(0);

    const isFullyPaid =
      typeof paidSum?.greaterThanOrEqualTo === 'function'
        ? paidSum.greaterThanOrEqualTo(canonicalTotalDecimal)
        : toNum(paidSum) >= canonicalTotalAmount;

    if (sale.paid && isFullyPaid) {
      return res.status(200).json({ success: true });
    }

    if (!isFullyPaid) {
      return res.status(409).json({
        message: 'ยอดชำระยังไม่ครบ ไม่สามารถปิดบิลได้',
        detail: {
          totalAmount: canonicalTotalAmount,
          paidAmount: round2(toNum(paidSum)),
          balanceAmount: round2(Math.max(0, canonicalTotalAmount - toNum(paidSum))),
        },
      });
    }

    await prisma.$transaction(async (tx) => {
      const projection = await projectSalePaymentStatus(tx, saleId);
      if (!projection.paid) {
        throw Object.assign(new Error('Payment evidence is insufficient'), {
          status: 409,
          code: 'PAYMENT_EVIDENCE_INSUFFICIENT',
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
    console.error('❌ [markSaleAsPaid]', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดขณะปิดบิล' });
  }
};

module.exports = { markSaleAsPaid };
