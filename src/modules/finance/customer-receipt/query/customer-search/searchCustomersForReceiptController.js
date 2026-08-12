const { prisma } = require('../../../../../../lib/prisma');
const { ensureBranchContext } = require('../../shared/customerReceiptContext');
const {
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
} = require('../../shared/customerReceiptConstants');
const { asNullableString } = require('../../shared/customerReceiptValue');

const sendError = (res, error, fallbackMessage) =>
  res.status(error?.statusCode || 500).json({
    success: false,
    message: error?.message || fallbackMessage || 'เกิดข้อผิดพลาดภายในระบบ',
  });

const searchCustomersForReceipt = async (req, res) => {
  try {
    const branchId = ensureBranchContext(req, res);
    if (!branchId) return;

    const mode = String(req.query?.mode || 'NAME').trim().toUpperCase();
    const keyword = asNullableString(req.query?.keyword);
    const limit = Math.min(
      MAX_SEARCH_LIMIT,
      Math.max(1, Number(req.query?.limit) || DEFAULT_SEARCH_LIMIT)
    );

    if (!keyword) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุคำค้นลูกค้า',
      });
    }

    const normalizedKeyword = String(keyword).trim();
    const digitsOnlyKeyword = normalizedKeyword.replace(/\D/g, '');

    const where =
      mode === 'PHONE'
        ? {
            user: {
              loginId: {
                contains: digitsOnlyKeyword || normalizedKeyword,
                mode: 'insensitive',
              },
            },
          }
        : {
            OR: [
              {
                name: {
                  contains: normalizedKeyword,
                  mode: 'insensitive',
                },
              },
              {
                companyName: {
                  contains: normalizedKeyword,
                  mode: 'insensitive',
                },
              },
              {
                taxId: {
                  contains: normalizedKeyword,
                  mode: 'insensitive',
                },
              },
              {
                user: {
                  loginId: {
                    contains: digitsOnlyKeyword || normalizedKeyword,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          };

    const rows = await prisma.customerProfile.findMany({
      where,
      select: {
        id: true,
        name: true,
        companyName: true,
        departmentName: true,
        taxId: true,
        user: {
          select: {
            loginId: true,
            email: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });

    const items = rows.map((item) => ({
      id: item.id,
      customerCode: null,
      name: item.name || null,
      companyName: item.companyName || null,
      departmentName: item.departmentName || null,
      phone: item.user?.loginId || null,
      email: item.user?.email || null,
      taxId: item.taxId || null,
    }));

    return res.status(200).json({
      success: true,
      data: {
        items,
      },
    });
  } catch (error) {
    console.error('❌ [searchCustomersForReceipt] error:', error);
    return sendError(res, error, 'ไม่สามารถค้นหาข้อมูลลูกค้าได้');
  }
};

module.exports = { searchCustomersForReceipt };
