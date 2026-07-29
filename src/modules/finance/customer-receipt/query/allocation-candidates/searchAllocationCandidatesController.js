const { prisma } = require('../../../../../../lib/prisma');
const { ensureBranchContext } = require('../../shared/customerReceiptContext');
const {
  asNullableString,
  asDateOrNull,
  toInt,
  roundMoney,
} = require('../../shared/customerReceiptValue');
const {
  RECEIPT_STATUS,
  SALE_PAYMENT_STATUS_MAP,
  DEFAULT_CANDIDATE_LIMIT,
  MAX_CANDIDATE_LIMIT,
} = require('../../shared/customerReceiptConstants');
const {
  buildSaleAllocationCandidate,
} = require('../../shared/customerReceiptResponse');

const sendError = (res, error, fallbackMessage) =>
  res.status(error?.statusCode || 500).json({
    success: false,
    message: error?.message || fallbackMessage || 'เกิดข้อผิดพลาดภายในระบบ',
  });

const searchAllocationCandidates = async (req, res) => {
  try {
    const branchId = ensureBranchContext(req, res);
    if (!branchId) return;

    const receiptId = toInt(req.params?.id);
    const keyword = asNullableString(req.query?.keyword);
    const fromDate = asDateOrNull(req.query?.fromDate);
    const toDate = asDateOrNull(req.query?.toDate);
    const limit = Math.min(
      MAX_CANDIDATE_LIMIT,
      Math.max(1, Number(req.query?.limit) || DEFAULT_CANDIDATE_LIMIT)
    );

    if (!Number.isInteger(receiptId) || receiptId <= 0) {
      return res.status(400).json({ success: false, message: 'receiptId ไม่ถูกต้อง' });
    }

    const receipt = await prisma.customerReceipt.findFirst({
      where: {
        id: receiptId,
        branchId,
      },
      select: {
        id: true,
        customerId: true,
        status: true,
        remainingAmount: true,
      },
    });

    if (!receipt) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายการรับชำระที่ต้องการ' });
    }

    if (receipt.status === RECEIPT_STATUS.CANCELLED) {
      return res.status(400).json({
        success: false,
        message: 'รายการรับชำระนี้ถูกยกเลิกแล้ว',
      });
    }

    const where = {
      branchId,
      customerId: receipt.customerId,
      OR: [
        { statusPayment: SALE_PAYMENT_STATUS_MAP.UNPAID },
        { statusPayment: SALE_PAYMENT_STATUS_MAP.PARTIALLY_PAID },
      ],
    };

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = fromDate;
      if (toDate) {
        const endOfDay = new Date(toDate);
        endOfDay.setHours(23, 59, 59, 999);
        where.createdAt.lte = endOfDay;
      }
    }

    if (keyword) {
      where.AND = [
        {
          OR: [
            {
              code: {
                contains: keyword,
                mode: 'insensitive',
              },
            },
            {
              note: {
                contains: keyword,
                mode: 'insensitive',
              },
            },
            {
              customer: {
                OR: [
                  {
                    name: {
                      contains: keyword,
                      mode: 'insensitive',
                    },
                  },
                  {
                    companyName: {
                      contains: keyword,
                      mode: 'insensitive',
                    },
                  },
                ],
              },
            },
          ],
        },
      ];
    }

    const items = await prisma.sale.findMany({
      where,
      select: {
        id: true,
        code: true,
        createdAt: true,
        dueDate: true,
        totalAmount: true,
        paidAmount: true,
        statusPayment: true,
        note: true,
        customerId: true,
        customer: true,
        employee: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });

    const normalizedItems = items
      .map(buildSaleAllocationCandidate)
      .filter((item) => item.outstandingAmount > 0);

    return res.status(200).json({
      success: true,
      data: {
        receipt: {
          id: receipt.id,
          customerId: receipt.customerId,
          status: receipt.status,
          remainingAmount: roundMoney(receipt.remainingAmount),
        },
        items: normalizedItems,
      },
    });
  } catch (error) {
    console.error('❌ [searchAllocationCandidates] error:', error);
    return sendError(res, error, 'ไม่สามารถค้นหารายการบิลที่ใช้ตัดชำระได้');
  }
};

module.exports = { searchAllocationCandidates };
