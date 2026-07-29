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
  asNullableString,
  deriveSalePaymentStatus,
} = require('../shared/customerReceiptValue');
const { receiptInclude } = require('../shared/customerReceiptIncludes');
const { buildReceiptResponse } = require('../shared/customerReceiptResponse');

const recalculateSalePaymentState = async (tx, saleId) => {
  const sale = await tx.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      totalAmount: true,
      paidAmount: true,
    },
  });

  if (!sale) return null;

  const nextPaidAmount = roundMoney(sale.paidAmount || 0);
  const nextStatusPayment = deriveSalePaymentStatus({
    totalAmount: sale.totalAmount,
    paidAmount: nextPaidAmount,
  });

  return tx.sale.update({
    where: { id: saleId },
    data: {
      paidAmount: nextPaidAmount,
      statusPayment: nextStatusPayment,
    },
  });
};

const sendError = (res, error, fallbackMessage) =>
  res.status(error?.statusCode || 500).json({
    success: false,
    message: error?.message || fallbackMessage || 'เกิดข้อผิดพลาดภายในระบบ',
  });

const cancelCustomerReceipt = async (req, res) => {
  try {
    const branchId = ensureBranchContext(req, res);
    if (!branchId) return;

    const employeeProfileId = ensureEmployeeContext(req, res);
    if (!employeeProfileId) return;

    const receiptId = toInt(req.params?.id);
    const cancelReason = asNullableString(req.body?.cancelReason);

    if (!Number.isInteger(receiptId) || receiptId <= 0) {
      return res.status(400).json({ success: false, message: 'receiptId ไม่ถูกต้อง' });
    }

    const cancelledReceipt = await prisma.$transaction(async (tx) => {
      await ensureEmployeeBelongsToBranchOrThrow(tx, { employeeProfileId, branchId });

      const receipt = await tx.customerReceipt.findFirst({
        where: {
          id: receiptId,
          branchId,
        },
        include: {
          allocations: {
            include: {
              sale: {
                include: {
                  items: {
                    include: {
                      stockItem: {
                        include: {
                          product: {
                            include: {
                              unit: true,
                            },
                          },
                        },
                      },
                    },
                  },
                  simpleItems: {
                    include: {
                      product: {
                        include: {
                          unit: true,
                        },
                      },
                    },
                  },
                },
              },
            },
            orderBy: { id: 'asc' },
          },
        },
      });

      if (!receipt) {
        const error = new Error('ไม่พบรายการรับชำระที่ต้องการยกเลิก');
        error.statusCode = 404;
        throw error;
      }

      if (receipt.status === RECEIPT_STATUS.CANCELLED) {
        const error = new Error('รายการรับชำระนี้ถูกยกเลิกไปแล้ว');
        error.statusCode = 400;
        throw error;
      }

      for (const allocation of receipt.allocations) {
        const currentSalePaidAmount = roundMoney(allocation.sale?.paidAmount || 0);
        const nextSalePaidAmount = roundMoney(
          currentSalePaidAmount - roundMoney(allocation.amount)
        );

        await tx.sale.update({
          where: { id: allocation.saleId },
          data: {
            paidAmount: nextSalePaidAmount < 0 ? 0 : nextSalePaidAmount,
          },
        });

        await recalculateSalePaymentState(tx, allocation.saleId);
      }

      await tx.customerReceiptAllocation.deleteMany({
        where: { receiptId },
      });

      return tx.customerReceipt.update({
        where: { id: receiptId },
        data: {
          status: RECEIPT_STATUS.CANCELLED,
          allocatedAmount: 0,
          remainingAmount: roundMoney(receipt.totalAmount),
          cancelledAt: new Date(),
          cancelledByEmployeeProfileId: employeeProfileId,
          cancelReason,
        },
        include: receiptInclude,
      });
    });

    return res.status(200).json({
      success: true,
      message: 'ยกเลิกรายการรับชำระเรียบร้อยแล้ว',
      data: buildReceiptResponse(cancelledReceipt),
    });
  } catch (error) {
    console.error('❌ [cancelCustomerReceipt] error:', error);
    return sendError(res, error, 'ไม่สามารถยกเลิกรายการรับชำระได้');
  }
};

module.exports = { cancelCustomerReceipt };
