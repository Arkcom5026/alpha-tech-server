const { prisma } = require('../../../../../../lib/prisma');
const { ensureBranchContext } = require('../../shared/customerReceiptContext');
const {
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
} = require('../../shared/customerReceiptConstants');
const {
  asNullableString,
  asDateOrNull,
  normalizePaymentMethod,
  toInt,
} = require('../../shared/customerReceiptValue');
const { receiptListInclude } = require('../../shared/customerReceiptIncludes');
const { buildReceiptResponse } = require('../../shared/customerReceiptResponse');

const sendError = (res, error, fallbackMessage) =>
  res.status(error?.statusCode || 500).json({
    success: false,
    message: error?.message || fallbackMessage || 'เกิดข้อผิดพลาดภายในระบบ',
  });

const searchCustomerReceipts = async (req, res) => {
  try {
    const branchId = ensureBranchContext(req, res);
    if (!branchId) return;

    const keyword = asNullableString(req.query?.keyword);
    const status = asNullableString(req.query?.status);
    const customerId = toInt(req.query?.customerId);
    const rawPaymentMethod = asNullableString(req.query?.paymentMethod);
    const paymentMethod = rawPaymentMethod ? normalizePaymentMethod(rawPaymentMethod) : null;
    const fromDate = asDateOrNull(req.query?.fromDate);
    const toDate = asDateOrNull(req.query?.toDate);
    const page = Math.max(1, Number(req.query?.page) || 1);
    const limit = Math.min(
      MAX_SEARCH_LIMIT,
      Math.max(1, Number(req.query?.limit) || DEFAULT_SEARCH_LIMIT)
    );
    const skip = (page - 1) * limit;

    const where = { branchId };

    if (status) where.status = status;
    if (Number.isInteger(customerId) && customerId > 0) where.customerId = customerId;

    if (rawPaymentMethod && !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'paymentMethod ไม่ถูกต้อง',
      });
    }

    if (paymentMethod) where.paymentMethod = paymentMethod;

    if (fromDate || toDate) {
      where.receivedAt = {};
      if (fromDate) where.receivedAt.gte = fromDate;
      if (toDate) {
        const endOfDay = new Date(toDate);
        endOfDay.setHours(23, 59, 59, 999);
        where.receivedAt.lte = endOfDay;
      }
    }

    if (keyword) {
      where.OR = [
        { code: { contains: keyword, mode: 'insensitive' } },
        { referenceNo: { contains: keyword, mode: 'insensitive' } },
        { note: { contains: keyword, mode: 'insensitive' } },
        {
          customer: {
            OR: [
              { name: { contains: keyword, mode: 'insensitive' } },
              { companyName: { contains: keyword, mode: 'insensitive' } },
              { taxId: { contains: keyword, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [total, items] = await prisma.$transaction([
      prisma.customerReceipt.count({ where }),
      prisma.customerReceipt.findMany({
        where,
        include: receiptListInclude,
        orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        items: items.map(buildReceiptResponse),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('❌ [searchCustomerReceipts] error:', error);
    return sendError(res, error, 'ไม่สามารถค้นหารายการรับชำระได้');
  }
};

module.exports = { searchCustomerReceipts };
