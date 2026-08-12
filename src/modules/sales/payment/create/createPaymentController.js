const { prisma } = require('../../../../lib/prisma');
const {
  projectSalePaymentStatus,
  consumeDeposit,
} = require('../../completion/services/salePaymentPostingService');
const {
  acquireCustomerMoneyTransactionLock,
} = require('../../../customer-money/shared/customerMoneyTransactionLock');
const { nextPaymentCode } = require('../code/nextPaymentCode');
const { D, isMoneyLike } = require('../shared/paymentMoney');
const {
  ALLOWED_PAYMENT_METHODS,
  normalizePaymentMethod,
} = require('../shared/paymentMethod');

const createPayments = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    const employeeIdRaw = req.user?.employeeId ?? req.user?.employeeProfileId;
    const employeeId = employeeIdRaw ? Number(employeeIdRaw) : null;
    const { saleId, note, combinedDocumentCode, paymentItems, receivedAt } = req.body || {};

    if (!saleId || !Array.isArray(paymentItems) || paymentItems.length === 0) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน saleId หรือรายการชำระเงินหายไป' });
    }
    if (!branchId) return res.status(401).json({ message: 'unauthorized' });

    const normalizedPaymentItems = paymentItems.map((item) => ({
      ...item,
      paymentMethod: normalizePaymentMethod(item.paymentMethod),
    }));

    for (const item of normalizedPaymentItems) {
      if (!isMoneyLike(item.amount) || Number(item.amount) <= 0) {
        return res.status(400).json({ message: 'จำนวนเงินไม่ถูกต้อง' });
      }
      if (!ALLOWED_PAYMENT_METHODS.has(item.paymentMethod)) {
        return res.status(400).json({
          message: `วิธีชำระเงินไม่ถูกต้อง: ${item.paymentMethod || '-'}`,
        });
      }
    }
    const requestedTotal = normalizedPaymentItems.reduce(
      (sum, item) => sum.plus(D(item.amount)),
      D(0),
    );
    const usesCustomerDeposit = normalizedPaymentItems.some(
      (item) => item.paymentMethod === 'DEPOSIT',
    );

    const result = await prisma.$transaction(
      async (tx) => {
        const sale = await tx.sale.findFirst({
          where: { id: Number(saleId), branchId, status: { not: 'CANCELLED' } },
          select: { id: true, totalAmount: true, customerId: true },
        });
        if (!sale) throw Object.assign(new Error('ไม่พบใบขายในสาขานี้'), { status: 404 });

        // All Customer Money writers acquire customer -> sale locks in that order.
        // Keeping the order consistent avoids a deposit-payment/settlement deadlock.
        if (usesCustomerDeposit) {
          if (!sale.customerId) {
            throw Object.assign(
              new Error('การใช้เงินมัดจำต้องเป็นใบขายที่มีลูกค้า'),
              { status: 409, code: 'DEPOSIT_CUSTOMER_REQUIRED' },
            );
          }
          await acquireCustomerMoneyTransactionLock(tx, sale.customerId);
        }

        // projectSalePaymentStatus acquires the shared sale-level transaction lock. Keeping that
        // lock until this transaction commits prevents a normal Payment and a Customer Money
        // Settlement from both consuming the same outstanding amount concurrently.
        const currentPaymentState = await projectSalePaymentStatus(tx, sale.id);
        const outstandingAmount = D(currentPaymentState.totalAmount)
          .minus(D(currentPaymentState.paidAmount));
        if (requestedTotal.greaterThan(outstandingAmount.plus(D('0.001')))) {
          throw Object.assign(
            new Error('ยอดรับชำระมากกว่ายอดค้างของใบขาย'),
            { status: 409, code: 'PAYMENT_EXCEEDS_OUTSTANDING' },
          );
        }

        const receivedAtDate = receivedAt ? new Date(receivedAt) : new Date();
        if (Number.isNaN(receivedAtDate.getTime())) {
          throw Object.assign(new Error('วันที่รับชำระไม่ถูกต้อง'), { status: 400 });
        }

        const code = await nextPaymentCode(tx, branchId);
        const payment = await tx.payment.create({
          data: {
            code,
            receivedAt: receivedAtDate,
            note: note || null,
            combinedDocumentCode: combinedDocumentCode || null,
            saleId: Number(saleId),
            employeeProfileId: employeeId || null,
            branchId,
            items: {
              create: normalizedPaymentItems.map((item) => ({
                paymentMethod: item.paymentMethod,
                amount: D(item.amount || 0),
                note: item.note || null,
                slipImage: item.slipImage || null,
                cardRef: item.cardRef || null,
                govImage: item.govImage || null,
              })),
            },
          },
          include: { items: true },
        });

        for (const item of normalizedPaymentItems) {
          if (item.paymentMethod === 'DEPOSIT' && item.customerDepositId) {
            await consumeDeposit(tx, {
              item,
              sale,
              paymentId: payment.id,
              branchId,
            });
          }
        }

        await projectSalePaymentStatus(tx, sale.id);
        return { paymentId: payment.id, code };
      },
      { timeout: 20000, maxWait: 20000 },
    );

    return res.status(201).json({
      message: 'บันทึกข้อมูลการชำระเงินแล้ว',
      paymentId: result.paymentId,
      code: result.code,
    });
  } catch (error) {
    console.error('❌ [createPayments] error:', error);
    const status = error?.status || 500;
    return res.status(status).json({
      message: error?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล',
      ...(error?.code ? { code: error.code } : {}),
    });
  }
};

module.exports = {
  createPayments,
};
