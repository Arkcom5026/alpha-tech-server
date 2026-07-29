const { prisma } = require('../../../../../../lib/prisma');
const { ensureBranchContext } = require('../../shared/customerReceiptContext');
const { toInt } = require('../../shared/customerReceiptValue');
const { receiptInclude } = require('../../shared/customerReceiptIncludes');
const { buildReceiptResponse } = require('../../shared/customerReceiptResponse');

const sendError = (res, error, fallbackMessage) =>
  res.status(error?.statusCode || 500).json({
    success: false,
    message: error?.message || fallbackMessage || 'เกิดข้อผิดพลาดภายในระบบ',
  });

const getCustomerReceiptById = async (req, res) => {
  try {
    const branchId = ensureBranchContext(req, res);
    if (!branchId) return;

    const receiptId = toInt(req.params?.id);
    if (!Number.isInteger(receiptId) || receiptId <= 0) {
      return res.status(400).json({ success: false, message: 'receiptId ไม่ถูกต้อง' });
    }

    const receipt = await prisma.customerReceipt.findFirst({
      where: { id: receiptId, branchId },
      include: receiptInclude,
    });

    if (!receipt) {
      const error = new Error('ไม่พบรายการรับชำระที่ต้องการ');
      error.statusCode = 404;
      throw error;
    }

    return res.status(200).json({
      success: true,
      data: buildReceiptResponse(receipt),
    });
  } catch (error) {
    console.error('❌ [getCustomerReceiptById] error:', error);
    return sendError(res, error, 'ไม่สามารถดึงรายละเอียดรายการรับชำระได้');
  }
};

module.exports = { getCustomerReceiptById };
