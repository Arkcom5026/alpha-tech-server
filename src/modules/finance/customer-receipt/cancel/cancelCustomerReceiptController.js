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
} = require('../shared/customerReceiptValue');
const { receiptInclude } = require('../shared/customerReceiptIncludes');
const { buildReceiptResponse } = require('../shared/customerReceiptResponse');
const {
  acquireSalePaymentProjectionLock,
  projectSalePaymentStatus,
} = require('../../../sales/completion/services/salePaymentPostingService');

const acquireCustomerReceiptCancellationLock = async (tx, receiptId) => {
  if (!tx?.$queryRaw) return;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(${-1006}, ${Number(receiptId)})`;
};

const sendError = (res, error, fallbackMessage) =>
  res.status(error?.statusCode || 500).json({
    success: false,
    message: error?.message || fallbackMessage || 'เกิดข้อผิดพลาดภายในระบบ',
    ...(error?.code ? { code: error.code } : {}),
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
      await acquireCustomerReceiptCancellationLock(tx, receiptId);

      const receipt = await tx.customerReceipt.findFirst({
        where: {
          id: receiptId,
          branchId,
        },
        include: {
          allocations: {
            select: { id: true, saleId: true },
            orderBy: { id: 'asc' },
          },
        },
      });

      if (!receipt) {
        const error = new Error('ไม่พบรายการรับชำระที่ต้องการยกเลิก');
        error.statusCode = 404;
        throw error;
      }

      if (String(receipt.code || '').startsWith('CMR-')) {
        const error = new Error('ใบรับเงิน Customer Money ต้องยกเลิกผ่านหน้ารับเงิน Customer Money เท่านั้น');
        error.statusCode = 409;
        error.code = 'CUSTOMER_MONEY_RECEIPT_LEGACY_CANCEL_FORBIDDEN';
        throw error;
      }

      if (receipt.status === RECEIPT_STATUS.CANCELLED) {
        const error = new Error('รายการรับชำระนี้ถูกยกเลิกไปแล้ว');
        error.statusCode = 400;
        throw error;
      }

      const saleIds = [...new Set(
        (receipt.allocations || [])
          .map((allocation) => Number(allocation.saleId))
          .filter(Number.isInteger),
      )].sort((left, right) => left - right);

      // Lock every affected sale in deterministic order before deleting payment evidence.
      // Other Payment/Settlement writers use the same sale-level advisory lock.
      for (const saleId of saleIds) {
        await acquireSalePaymentProjectionLock(tx, saleId);
      }

      await tx.customerReceiptAllocation.deleteMany({
        where: { receiptId },
      });

      const cancelled = await tx.customerReceipt.update({
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

      for (const saleId of saleIds) {
        await projectSalePaymentStatus(tx, saleId);
      }

      return cancelled;
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

module.exports = {
  cancelCustomerReceipt,
  acquireCustomerReceiptCancellationLock,
};
