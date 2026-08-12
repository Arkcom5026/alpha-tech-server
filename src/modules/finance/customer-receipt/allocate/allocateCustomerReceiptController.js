const { prisma } = require('../../../../../lib/prisma');
const { RECEIPT_STATUS } = require('../shared/customerReceiptConstants');
const {
  ensureBranchContext,
  ensureEmployeeContext,
  ensureEmployeeBelongsToBranchOrThrow,
} = require('../shared/customerReceiptContext');
const {
  toInt,
  roundMoney,
  isPositiveMoney,
  asNullableString,
} = require('../shared/customerReceiptValue');
const { receiptInclude } = require('../shared/customerReceiptIncludes');
const {
  buildReceiptResponse,
  normalizeAllocationSale,
} = require('../shared/customerReceiptResponse');
const {
  projectSalePaymentStatus,
} = require('../../../sales/completion/services/salePaymentPostingService');

const findReceiptOrThrow = async (tx, { receiptId, branchId }) => {
  const receipt = await tx.customerReceipt.findFirst({
    where: { id: receiptId, branchId },
    include: receiptInclude,
  });

  if (!receipt) {
    const error = new Error('ไม่พบรายการรับชำระที่ต้องการ');
    error.statusCode = 404;
    throw error;
  }

  return receipt;
};

const findSaleOrThrow = async (tx, { saleId, branchId }) => {
  const sale = await tx.sale.findFirst({
    where: { id: saleId, branchId, status: { not: 'CANCELLED' } },
    include: { customer: true },
  });

  if (!sale) {
    const error = new Error('ไม่พบบิลขายที่ต้องการตัดรับชำระ');
    error.statusCode = 404;
    throw error;
  }

  return sale;
};

const acquireCustomerReceiptAllocationLock = async (tx, receiptId) => {
  if (!tx?.$queryRaw) return;
  await tx.$queryRaw`SELECT 1::int AS "locked" FROM (SELECT pg_advisory_xact_lock(${-1006}::int, ${Number(receiptId)}::int)) AS advisory_lock`;
};

const sendError = (res, error, fallbackMessage) =>
  res.status(error?.statusCode || 500).json({
    success: false,
    message: error?.message || fallbackMessage || 'เกิดข้อผิดพลาดภายในระบบ',
    ...(error?.code ? { code: error.code } : {}),
  });

const allocateCustomerReceipt = async (req, res) => {
  try {
    const branchId = ensureBranchContext(req, res);
    if (!branchId) return;

    const employeeProfileId = ensureEmployeeContext(req, res);
    if (!employeeProfileId) return;

    const receiptId = toInt(req.params?.id);
    const saleId = toInt(req.body?.saleId);
    const amount = roundMoney(req.body?.amount);
    const note = asNullableString(req.body?.note);

    if (!Number.isInteger(receiptId) || receiptId <= 0) {
      return res.status(400).json({ success: false, message: 'receiptId ไม่ถูกต้อง' });
    }

    if (!Number.isInteger(saleId) || saleId <= 0) {
      return res.status(400).json({ success: false, message: 'saleId ไม่ถูกต้อง' });
    }

    if (!isPositiveMoney(amount)) {
      return res.status(400).json({
        success: false,
        message: 'จำนวนเงินที่ตัดชำระต้องมากกว่า 0',
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      await ensureEmployeeBelongsToBranchOrThrow(tx, { employeeProfileId, branchId });
      await acquireCustomerReceiptAllocationLock(tx, receiptId);

      const receipt = await findReceiptOrThrow(tx, { receiptId, branchId });

      if (String(receipt.code || '').startsWith('CMR-')) {
        const error = new Error('ใบรับเงิน Customer Money ต้องนำไปใช้ผ่านหน้าตัดยอด Customer Money เท่านั้น');
        error.statusCode = 409;
        error.code = 'CUSTOMER_MONEY_RECEIPT_LEGACY_ALLOCATION_FORBIDDEN';
        throw error;
      }

      if (receipt.status === RECEIPT_STATUS.CANCELLED) {
        const error = new Error('ไม่สามารถตัดชำระได้ เนื่องจากรายการรับชำระถูกยกเลิกแล้ว');
        error.statusCode = 400;
        throw error;
      }

      if (
        receipt.status === RECEIPT_STATUS.FULLY_ALLOCATED ||
        roundMoney(receipt.remainingAmount) <= 0
      ) {
        const error = new Error('ใบรับชำระนี้ถูกตัดครบแล้ว');
        error.statusCode = 400;
        throw error;
      }

      const currentRemainingAmount = roundMoney(receipt.remainingAmount);

      if (amount > currentRemainingAmount) {
        const error = new Error('จำนวนเงินที่ตัดชำระมากกว่ายอดคงเหลือของใบรับชำระ');
        error.statusCode = 400;
        throw error;
      }

      const sale = await findSaleOrThrow(tx, { saleId, branchId });

      if (receipt.customerId !== sale.customerId) {
        const error = new Error('ไม่สามารถตัดชำระข้ามลูกค้าได้');
        error.statusCode = 400;
        throw error;
      }

      // This projection acquires the shared sale-payment lock and includes normal payments,
      // legacy CR allocations and Customer Money settlements before we consume outstanding.
      const currentPaymentState = await projectSalePaymentStatus(tx, saleId);
      const saleOutstandingAmount = Math.max(
        0,
        roundMoney(Number(currentPaymentState.totalAmount) - Number(currentPaymentState.paidAmount)),
      );

      if (saleOutstandingAmount <= 0) {
        const error = new Error('บิลนี้ถูกชำระครบแล้ว');
        error.statusCode = 400;
        throw error;
      }

      if (amount > saleOutstandingAmount + 0.001) {
        const error = new Error('จำนวนเงินที่ตัดชำระมากกว่ายอดค้างชำระของบิล');
        error.statusCode = 400;
        throw error;
      }

      const allocation = await tx.customerReceiptAllocation.create({
        data: {
          receiptId,
          saleId,
          amount,
          note,
          createdByEmployeeProfileId: employeeProfileId,
        },
        include: {
          sale: {
            include: {
              items: {
                include: {
                  stockItem: {
                    include: {
                      product: {
                        include: { unit: true },
                      },
                    },
                  },
                },
              },
              simpleItems: {
                include: {
                  product: {
                    include: { unit: true },
                  },
                },
              },
            },
          },
          createdByEmployeeProfile: true,
        },
      });

      const nextReceiptAllocatedAmount = roundMoney(
        roundMoney(receipt.allocatedAmount || 0) + amount
      );
      const nextReceiptRemainingAmount = roundMoney(currentRemainingAmount - amount);

      await tx.customerReceipt.update({
        where: { id: receiptId },
        data: {
          allocatedAmount: nextReceiptAllocatedAmount,
          remainingAmount: nextReceiptRemainingAmount,
          status:
            nextReceiptRemainingAmount <= 0
              ? RECEIPT_STATUS.FULLY_ALLOCATED
              : RECEIPT_STATUS.ACTIVE,
        },
      });

      await projectSalePaymentStatus(tx, saleId);
      const freshReceipt = await findReceiptOrThrow(tx, { receiptId, branchId });

      return {
        allocation: {
          ...allocation,
          amount: roundMoney(allocation.amount),
          sale: normalizeAllocationSale(allocation.sale),
        },
        receipt: buildReceiptResponse(freshReceipt),
      };
    });

    return res.status(201).json({
      success: true,
      message: 'ตัดชำระจากใบรับเงินเรียบร้อยแล้ว',
      data: result,
    });
  } catch (error) {
    console.error('❌ [allocateCustomerReceipt] error:', error);
    return sendError(res, error, 'ไม่สามารถตัดชำระจากใบรับเงินได้');
  }
};

module.exports = {
  allocateCustomerReceipt,
  acquireCustomerReceiptAllocationLock,
};
