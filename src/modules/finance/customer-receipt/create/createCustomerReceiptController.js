const { prisma } = require('../../../../../lib/prisma');
const { RECEIPT_STATUS } = require('../shared/customerReceiptConstants');
const {
  normalizePaymentMethod,
  toInt,
  roundMoney,
  isPositiveMoney,
  asNullableString,
  asDateOrNull,
} = require('../shared/customerReceiptValue');
const {
  ensureBranchContext,
  ensureEmployeeContext,
  ensureEmployeeBelongsToBranchOrThrow,
} = require('../shared/customerReceiptContext');
const { receiptInclude } = require('../shared/customerReceiptIncludes');
const { buildReceiptResponse } = require('../shared/customerReceiptResponse');

const buildReceiptCode = async (tx, branchId) => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const prefix = `CR-${yy}${mm}${dd}-`;

  const countToday = await tx.customerReceipt.count({
    where: {
      branchId,
      code: { startsWith: prefix },
    },
  });

  return `${prefix}${String(countToday + 1).padStart(4, '0')}`;
};

const sendError = (res, error, fallbackMessage) => {
  const statusCode = error?.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message: error?.message || fallbackMessage || 'เกิดข้อผิดพลาดภายในระบบ',
  });
};

const createCustomerReceipt = async (req, res) => {
  try {
    const branchId = ensureBranchContext(req, res);
    if (!branchId) return;

    const employeeProfileId = ensureEmployeeContext(req, res);
    if (!employeeProfileId) return;

    const customerId = toInt(req.body?.customerId);
    const totalAmount = roundMoney(req.body?.totalAmount);
    const receivedAt = asDateOrNull(req.body?.receivedAt) || new Date();
    const rawPaymentMethod = asNullableString(req.body?.paymentMethod);
    const paymentMethod = normalizePaymentMethod(rawPaymentMethod);
    const referenceNo = asNullableString(req.body?.referenceNo);
    const note = asNullableString(req.body?.note);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ customerId ให้ถูกต้อง',
      });
    }

    if (!isPositiveMoney(totalAmount)) {
      return res.status(400).json({
        success: false,
        message: 'totalAmount ต้องมากกว่า 0',
      });
    }

    if (!rawPaymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ paymentMethod',
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'paymentMethod ไม่ถูกต้อง',
      });
    }

    const createdReceipt = await prisma.$transaction(async (tx) => {
      await ensureEmployeeBelongsToBranchOrThrow(tx, {
        employeeProfileId,
        branchId,
      });

      const customer = await tx.customerProfile.findFirst({
        where: { id: customerId, branchId },
        select: { id: true },
      });

      if (!customer) {
        const error = new Error('ไม่พบข้อมูลลูกค้าที่ต้องการรับชำระในสาขานี้');
        error.statusCode = 404;
        throw error;
      }

      const code = await buildReceiptCode(tx, branchId);

      return tx.customerReceipt.create({
        data: {
          code,
          branchId,
          customerId,
          receivedAt,
          totalAmount,
          allocatedAmount: 0,
          remainingAmount: totalAmount,
          paymentMethod,
          referenceNo,
          note,
          status: RECEIPT_STATUS.ACTIVE,
          createdByEmployeeProfileId: employeeProfileId,
        },
        include: receiptInclude,
      });
    });

    return res.status(201).json({
      success: true,
      message: 'สร้างรายการรับชำระเรียบร้อยแล้ว',
      data: buildReceiptResponse(createdReceipt),
    });
  } catch (error) {
    console.error('❌ [createCustomerReceipt] error:', error);
    return sendError(res, error, 'ไม่สามารถสร้างรายการรับชำระได้');
  }
};

module.exports = { createCustomerReceipt };
