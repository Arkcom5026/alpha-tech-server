const { prisma } = require('../../../../lib/prisma');
const {
  projectSalePaymentStatus,
} = require('../../completion/services/salePaymentPostingService');
const {
  calculateAvailableCustomerMoney,
} = require('../../../customer-money/balance/customerMoneySourcePoolService');
const {
  updateCustomerMoneyBalance,
} = require('../../../customer-money/balance/updateCustomerMoneyBalanceService');
const {
  acquireCustomerMoneyTransactionLock,
} = require('../../../customer-money/shared/customerMoneyTransactionLock');

const cancelPayment = async (req, res) => {
  try {
    const { paymentId, note } = req.body || {};
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ message: 'unauthorized' });

    const payment = await prisma.payment.findUnique({
      where: { id: Number(paymentId) },
      include: {
        items: true,
        sale: { select: { customerId: true } },
      },
    });

    if (!payment || Number(payment.branchId) !== branchId) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลการชำระเงินในสาขานี้' });
    }
    if (payment.isCancelled) {
      return res.status(400).json({ message: 'รายการนี้ถูกยกเลิกแล้ว' });
    }

    await prisma.$transaction(
      async (tx) => {
        const usages = tx.depositUsage && typeof tx.depositUsage.findMany === 'function'
          ? await tx.depositUsage.findMany({ where: { paymentId: payment.id } })
          : [];
        const hasDepositPayment = usages.length > 0
          || payment.items.some((item) => item.paymentMethod === 'DEPOSIT');
        const customerId = Number(payment.sale?.customerId);

        if (hasDepositPayment && Number.isInteger(customerId) && customerId > 0) {
          await acquireCustomerMoneyTransactionLock(tx, customerId);
        }

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            isCancelled: true,
            cancelNote: note || null,
            cancelledAt: new Date(),
          },
        });

        if (usages.length > 0) {
          for (const usage of usages) {
            await tx.customerDeposit.update({
              where: { id: usage.customerDepositId },
              data: { usedAmount: { decrement: usage.amountUsed } },
            });

            const deposit = await tx.customerDeposit.findUnique({
              where: { id: usage.customerDepositId },
              select: { usedAmount: true, totalAmount: true },
            });
            const used = Number(deposit?.usedAmount || 0);
            const total = Number(deposit?.totalAmount || 0);
            if (used < total) {
              await tx.customerDeposit.update({
                where: { id: usage.customerDepositId },
                data: { status: 'ACTIVE' },
              });
            }
          }
        } else {
          for (const item of payment.items) {
            if (item.paymentMethod === 'DEPOSIT' && item.customerDepositId) {
              await tx.customerDeposit.update({
                where: { id: item.customerDepositId },
                data: { usedAmount: { decrement: item.amount } },
              });

              const deposit = await tx.customerDeposit.findUnique({
                where: { id: item.customerDepositId },
                select: { usedAmount: true, totalAmount: true },
              });
              const used = Number(deposit?.usedAmount || 0);
              const total = Number(deposit?.totalAmount || 0);
              if (used < total) {
                await tx.customerDeposit.update({
                  where: { id: item.customerDepositId },
                  data: { status: 'ACTIVE' },
                });
              }
            }
          }
        }

        if (
          hasDepositPayment
          && Number.isInteger(customerId)
          && customerId > 0
          && tx?.customerDeposit?.findMany
          && tx?.customerReceipt?.findMany
        ) {
          const availableAmount = await calculateAvailableCustomerMoney(tx, { branchId, customerId });
          await updateCustomerMoneyBalance({
            client: tx,
            branchId,
            customerId,
            availableAmount,
          });
        }

        await projectSalePaymentStatus(tx, payment.saleId);
      },
      { timeout: 20000, maxWait: 20000 },
    );

    return res.json({ message: 'ยกเลิกรายการชำระเงินเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('❌ [cancelPayment] error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการยกเลิก' });
  }
};

module.exports = {
  cancelPayment,
};