// controllers/customerReceiptController.js

const { prisma, Prisma } = require('../lib/prisma');

const RECEIPT_STATUS = {
  ACTIVE: 'ACTIVE',
  FULLY_ALLOCATED: 'FULLY_ALLOCATED',
  CANCELLED: 'CANCELLED',
};

const SALE_PAYMENT_STATUS_MAP = {
  UNPAID: 'UNPAID',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
};

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 200;
const DEFAULT_CANDIDATE_LIMIT = 50;
const MAX_CANDIDATE_LIMIT = 200;

const PAYMENT_METHOD_VALUES = new Set([
  'CASH',
  'TRANSFER',
  'CARD',
  'QR',
  'E_WALLET',
  'CHEQUE',
  'OTHER',
  'DEPOSIT',
]);

const PAYMENT_METHOD_ALIASES = {
  QR_CODE: 'QR',
  QR_PAYMENT: 'QR',
  BANK_TRANSFER: 'TRANSFER',
  CREDIT_CARD: 'CARD',
  EWALLET: 'E_WALLET',
  E_WALLET_PAYMENT: 'E_WALLET',
};

const normalizePaymentMethod = (value) => {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return null;

  const normalized = PAYMENT_METHOD_ALIASES[raw] || raw;
  return PAYMENT_METHOD_VALUES.has(normalized) ? normalized : null;
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isInteger(n) ? n : undefined;
};

const roundMoney = (value) => {
  const n = toNumber(value, 0);
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

const isPositiveMoney = (value) => roundMoney(value) > 0;

const asNullableString = (value) => {
  if (value == null) return null;
  const str = String(value).trim();
  return str || null;
};

const asDateOrNull = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const getBranchIdFromRequest = (req) => {
  const branchId = Number(req?.user?.branchId);
  return Number.isInteger(branchId) && branchId > 0 ? branchId : null;
};

const getEmployeeProfileIdFromRequest = (req) => {
  const employeeProfileId = Number(
    req?.user?.employeeProfileId ?? req?.user?.employeeId ?? req?.employee?.id
  );
  return Number.isInteger(employeeProfileId) && employeeProfileId > 0
    ? employeeProfileId
    : null;
};

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

const deriveSalePaymentStatus = ({ totalAmount, paidAmount }) => {
  const total = roundMoney(totalAmount);
  const paid = roundMoney(paidAmount);

  if (paid <= 0) return SALE_PAYMENT_STATUS_MAP.UNPAID;
  if (paid >= total && total > 0) return SALE_PAYMENT_STATUS_MAP.PAID;
  return SALE_PAYMENT_STATUS_MAP.PARTIALLY_PAID;
};

const computeRemainingAmount = ({ totalAmount, allocatedAmount }) => {
  return roundMoney(roundMoney(totalAmount) - roundMoney(allocatedAmount));
};

const getSaleOutstandingAmount = (sale) => {
  const totalAmount = roundMoney(sale?.totalAmount || 0);
  const paidAmount = roundMoney(sale?.paidAmount || 0);
  return roundMoney(totalAmount - paidAmount);
};

const normalizeSaleItemForPrint = (saleItem) => {
  if (!saleItem) return saleItem;

  const quantity =
    saleItem?.quantity ??
    saleItem?.qty ??
    saleItem?.count ??
    saleItem?.itemQty ??
    saleItem?.qtyOrdered ??
    saleItem?.qtySold ??
    saleItem?.quantitySold ??
    saleItem?.productQty ??
    1;

  const unitPriceIncVat =
    saleItem?.unitPriceIncVat ??
    saleItem?.unitPrice ??
    saleItem?.price ??
    saleItem?.sellingPrice ??
    saleItem?.salePrice ??
    0;

  const amount =
    saleItem?.amount ??
    saleItem?.total ??
    saleItem?.totalAmount ??
    saleItem?.lineTotal ??
    saleItem?.subtotal ??
    saleItem?.netAmount ??
    saleItem?.grandTotal ??
    (Number(unitPriceIncVat || 0) * Number(quantity || 0));

  return {
    ...saleItem,
    productName:
      saleItem?.productName ||
      saleItem?.name ||
      saleItem?.description ||
      saleItem?.title ||
      saleItem?.itemName ||
      saleItem?.stockItem?.product?.name ||
      saleItem?.product?.name ||
      saleItem?.product?.productName ||
      saleItem?.product?.title ||
      (saleItem?.stockItem?.productId ? `สินค้า #${saleItem.stockItem.productId}` : '-') ||
      '-',
    productModel:
      saleItem?.productModel ||
      saleItem?.model ||
      saleItem?.stockItem?.product?.productModel ||
      saleItem?.product?.productModel ||
      '',
    quantity: toNumber(quantity, 0),
    unit:
      saleItem?.unit ||
      saleItem?.unitName ||
      saleItem?.stockItem?.product?.unit?.name ||
      saleItem?.product?.unit?.name ||
      saleItem?.unitObj?.name ||
      'ชิ้น',
    unitPrice:
      unitPriceIncVat != null ? roundMoney(unitPriceIncVat) : roundMoney(saleItem?.unitPrice),
    unitPriceIncVat:
      unitPriceIncVat != null ? roundMoney(unitPriceIncVat) : roundMoney(saleItem?.unitPriceIncVat),
    price: saleItem?.price != null ? roundMoney(saleItem.price) : roundMoney(unitPriceIncVat),
    amount: amount != null ? roundMoney(amount) : 0,
    totalAmount: amount != null ? roundMoney(amount) : roundMoney(saleItem?.totalAmount),
    total: amount != null ? roundMoney(amount) : roundMoney(saleItem?.total),
  };
};

const normalizeAllocationSale = (sale) => {
  if (!sale) return null;

  const stockTrackedItems = Array.isArray(sale.items)
    ? sale.items.map(normalizeSaleItemForPrint)
    : [];

  const simpleItems = Array.isArray(sale.simpleItems)
    ? sale.simpleItems.map(normalizeSaleItemForPrint)
    : [];

  const saleItems = [...stockTrackedItems, ...simpleItems];

  return {
    ...sale,
    totalAmount: roundMoney(sale.totalAmount),
    paidAmount: roundMoney(sale.paidAmount),
    outstandingAmount: getSaleOutstandingAmount(sale),
    saleItems,
  };
};

const buildReceiptResponse = (receipt) => {
  if (!receipt) return null;

  const allocations = Array.isArray(receipt.allocations) ? receipt.allocations : [];
  const totalAmount = roundMoney(receipt.totalAmount);
  const allocatedAmount = roundMoney(
    receipt.allocatedAmount != null
      ? receipt.allocatedAmount
      : allocations.reduce((sum, item) => sum + toNumber(item.amount, 0), 0)
  );
  const remainingAmount =
    receipt.remainingAmount != null
      ? roundMoney(receipt.remainingAmount)
      : computeRemainingAmount({ totalAmount, allocatedAmount });

  return {
    ...receipt,
    totalAmount,
    allocatedAmount,
    remainingAmount,
    allocations: allocations.map((item) => ({
      ...item,
      amount: roundMoney(item.amount),
      sale: normalizeAllocationSale(item.sale),
    })),
  };
};

const buildSaleAllocationCandidate = (sale) => {
  const totalAmount = roundMoney(sale?.totalAmount || 0);
  const paidAmount = roundMoney(sale?.paidAmount || 0);
  const outstandingAmount = roundMoney(totalAmount - paidAmount);

  return {
    ...sale,
    totalAmount,
    paidAmount,
    outstandingAmount,
  };
};

const branchAddressInclude = {
  subdistrict: {
    include: {
      district: {
        include: {
          province: true,
        },
      },
    },
  },
};

const receiptInclude = {
  branch: {
    include: branchAddressInclude,
  },
  customer: true,
  createdByEmployeeProfile: true,
  cancelledByEmployeeProfile: true,
  allocations: {
    include: {
      sale: {
        include: {
          branch: {
            include: branchAddressInclude,
          },
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
      createdByEmployeeProfile: true,
    },
    orderBy: { id: 'asc' },
  },
};

const receiptListInclude = {
  branch: true,
  customer: true,
  createdByEmployeeProfile: true,
  cancelledByEmployeeProfile: true,
  _count: {
    select: {
      allocations: true,
    },
  },
  allocations: {
    include: {
      sale: {
        select: {
          id: true,
          code: true,
          totalAmount: true,
          paidAmount: true,
          statusPayment: true,
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
      createdByEmployeeProfile: true,
    },
    orderBy: { id: 'asc' },
  },
};

const findReceiptOrThrow = async (tx, { receiptId, branchId }) => {
  const receipt = await tx.customerReceipt.findFirst({
    where: {
      id: receiptId,
      branchId,
    },
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
    where: {
      id: saleId,
      branchId,
    },
    include: {
      customer: true,
    },
  });

  if (!sale) {
    const error = new Error('ไม่พบบิลขายที่ต้องการตัดรับชำระ');
    error.statusCode = 404;
    throw error;
  }

  return sale;
};

const ensureBranchContext = (req, res) => {
  const branchId = getBranchIdFromRequest(req);
  if (!branchId) {
    res.status(400).json({
      success: false,
      message: 'ไม่พบ branchId ใน session ผู้ใช้งาน',
    });
    return null;
  }
  return branchId;
};

const ensureEmployeeContext = (req, res) => {
  const employeeProfileId = getEmployeeProfileIdFromRequest(req);
  if (!employeeProfileId) {
    res.status(400).json({
      success: false,
      message: 'ไม่พบข้อมูลพนักงานผู้ทำรายการ',
    });
    return null;
  }
  return employeeProfileId;
};

const ensureEmployeeBelongsToBranchOrThrow = async (tx, { employeeProfileId, branchId }) => {
  const employeeProfile = await tx.employeeProfile.findFirst({
    where: {
      id: employeeProfileId,
      branchId,
      active: true,
    },
    select: { id: true },
  });

  if (!employeeProfile) {
    const error = new Error('พนักงานไม่มีสิทธิ์ทำรายการในสาขานี้');
    error.statusCode = 403;
    throw error;
  }
};

const parseSearchFilters = (query = {}) => {
  const page = Math.max(toInt(query.page) || 1, 1);
  const limit = Math.min(Math.max(toInt(query.limit) || DEFAULT_SEARCH_LIMIT, 1), MAX_SEARCH_LIMIT);
  const keyword = asNullableString(query.keyword);
  const status = asNullableString(query.status)?.toUpperCase();
  const customerId = toInt(query.customerId);
  const paymentMethod = normalizePaymentMethod(query.paymentMethod);
  const fromDate = asDateOrNull(query.fromDate);
  const toDate = asDateOrNull(query.toDate);

  if (toDate) {
    toDate.setHours(23, 59, 59, 999);
  }

  return {
    page,
    limit,
    keyword,
    status,
    customerId,
    paymentMethod,
    fromDate,
    toDate,
  };
};

const createCustomerReceipt = async (req, res) => {
  const branchId = ensureBranchContext(req, res);
  if (!branchId) return;

  const employeeProfileId = ensureEmployeeContext(req, res);
  if (!employeeProfileId) return;

  const customerId = toInt(req.body?.customerId);
  const totalAmount = roundMoney(req.body?.totalAmount);
  const paymentMethod = normalizePaymentMethod(req.body?.paymentMethod);
  const receivedAt = asDateOrNull(req.body?.receivedAt) || new Date();
  const note = asNullableString(req.body?.note);

  if (!customerId) {
    return res.status(400).json({ success: false, message: 'กรุณาเลือกลูกค้า' });
  }

  if (!isPositiveMoney(totalAmount)) {
    return res.status(400).json({ success: false, message: 'ยอดรับชำระต้องมากกว่า 0' });
  }

  if (!paymentMethod) {
    return res.status(400).json({ success: false, message: 'วิธีรับชำระไม่ถูกต้อง' });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      await ensureEmployeeBelongsToBranchOrThrow(tx, { employeeProfileId, branchId });

      const customer = await tx.customerProfile.findFirst({
        where: {
          id: customerId,
          branchId,
        },
        select: { id: true },
      });

      if (!customer) {
        const error = new Error('ไม่พบลูกค้าในสาขาปัจจุบัน');
        error.statusCode = 404;
        throw error;
      }

      const code = await buildReceiptCode(tx, branchId);

      return tx.customerReceipt.create({
        data: {
          code,
          branchId,
          customerId,
          totalAmount: new Prisma.Decimal(totalAmount),
          allocatedAmount: new Prisma.Decimal(0),
          remainingAmount: new Prisma.Decimal(totalAmount),
          paymentMethod,
          receivedAt,
          note,
          createdByEmployeeProfileId: employeeProfileId,
        },
        include: receiptInclude,
      });
    });

    return res.status(201).json({
      success: true,
      message: 'สร้างรายการรับชำระเรียบร้อยแล้ว',
      data: buildReceiptResponse(created),
    });
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error?.message || 'ไม่สามารถสร้างรายการรับชำระได้',
    });
  }
};

const getCustomerReceiptById = async (req, res) => {
  const branchId = ensureBranchContext(req, res);
  if (!branchId) return;

  const receiptId = toInt(req.params?.id);
  if (!receiptId) {
    return res.status(400).json({ success: false, message: 'เลขที่รายการรับชำระไม่ถูกต้อง' });
  }

  try {
    const receipt = await prisma.customerReceipt.findFirst({
      where: {
        id: receiptId,
        branchId,
      },
      include: receiptInclude,
    });

    if (!receipt) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายการรับชำระที่ต้องการ' });
    }

    return res.json({
      success: true,
      data: buildReceiptResponse(receipt),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'ไม่สามารถโหลดรายละเอียดรายการรับชำระได้',
    });
  }
};

const searchCustomerReceipts = async (req, res) => {
  const branchId = ensureBranchContext(req, res);
  if (!branchId) return;

  const filters = parseSearchFilters(req.query);
  const where = {
    branchId,
    ...(filters.keyword
      ? {
          OR: [
            { code: { contains: filters.keyword, mode: 'insensitive' } },
            { customer: { name: { contains: filters.keyword, mode: 'insensitive' } } },
            { customer: { companyName: { contains: filters.keyword, mode: 'insensitive' } } },
          ],
        }
      : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
    ...(filters.fromDate || filters.toDate
      ? {
          receivedAt: {
            ...(filters.fromDate ? { gte: filters.fromDate } : {}),
            ...(filters.toDate ? { lte: filters.toDate } : {}),
          },
        }
      : {}),
  };

  try {
    const [items, total] = await prisma.$transaction([
      prisma.customerReceipt.findMany({
        where,
        include: receiptListInclude,
        orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.customerReceipt.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        items: items.map(buildReceiptResponse),
        pagination: {
          total,
          page: filters.page,
          limit: filters.limit,
          totalPages: Math.max(Math.ceil(total / filters.limit), 1),
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'ไม่สามารถค้นหารายการรับชำระได้',
    });
  }
};

const searchCustomerProfiles = async (req, res) => {
  const branchId = ensureBranchContext(req, res);
  if (!branchId) return;

  const keyword = asNullableString(req.query?.keyword);
  const mode = asNullableString(req.query?.mode)?.toUpperCase() || 'NAME';

  if (!keyword) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกคำค้นลูกค้า' });
  }

  const where = {
    branchId,
    ...(mode === 'PHONE'
      ? {
          OR: [
            { phone: { contains: keyword } },
            { user: { loginId: { contains: keyword } } },
          ],
        }
      : {
          OR: [
            { name: { contains: keyword, mode: 'insensitive' } },
            { companyName: { contains: keyword, mode: 'insensitive' } },
          ],
        }),
  };

  try {
    const items = await prisma.customerProfile.findMany({
      where,
      include: {
        user: {
          select: {
            loginId: true,
          },
        },
      },
      orderBy: [{ companyName: 'asc' }, { name: 'asc' }],
      take: 50,
    });

    return res.json({ success: true, data: { items } });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || 'ไม่สามารถค้นหาลูกค้าได้',
    });
  }
};

const getAllocationCandidates = async (req, res) => {
  const branchId = ensureBranchContext(req, res);
  if (!branchId) return;

  const receiptId = toInt(req.params?.id);
  if (!receiptId) {
    return res.status(400).json({ success: false, message: 'เลขที่รายการรับชำระไม่ถูกต้อง' });
  }

  const page = Math.max(toInt(req.query?.page) || 1, 1);
  const limit = Math.min(
    Math.max(toInt(req.query?.limit) || DEFAULT_CANDIDATE_LIMIT, 1),
    MAX_CANDIDATE_LIMIT
  );

  try {
    const receipt = await findReceiptOrThrow(prisma, { receiptId, branchId });
    const remainingAmount = roundMoney(receipt.remainingAmount);

    const [sales, total] = await prisma.$transaction([
      prisma.sale.findMany({
        where: {
          branchId,
          customerId: receipt.customerId,
          status: 'COMPLETED',
          statusPayment: {
            in: [SALE_PAYMENT_STATUS_MAP.UNPAID, SALE_PAYMENT_STATUS_MAP.PARTIALLY_PAID],
          },
        },
        include: {
          customer: true,
        },
        orderBy: [{ soldAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.sale.count({
        where: {
          branchId,
          customerId: receipt.customerId,
          status: 'COMPLETED',
          statusPayment: {
            in: [SALE_PAYMENT_STATUS_MAP.UNPAID, SALE_PAYMENT_STATUS_MAP.PARTIALLY_PAID],
          },
        },
      }),
    ]);

    const candidates = sales
      .map(buildSaleAllocationCandidate)
      .filter((sale) => sale.outstandingAmount > 0);

    return res.json({
      success: true,
      data: {
        receipt: buildReceiptResponse(receipt),
        items: candidates,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        },
        summary: {
          receiptRemainingAmount: remainingAmount,
          candidateOutstandingAmount: roundMoney(
            candidates.reduce((sum, sale) => sum + sale.outstandingAmount, 0)
          ),
        },
      },
    });
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error?.message || 'ไม่สามารถโหลดบิลค้างชำระได้',
    });
  }
};

const allocateCustomerReceipt = async (req, res) => {
  const branchId = ensureBranchContext(req, res);
  if (!branchId) return;

  const employeeProfileId = ensureEmployeeContext(req, res);
  if (!employeeProfileId) return;

  const receiptId = toInt(req.params?.id);
  const saleId = toInt(req.body?.saleId);
  const amount = roundMoney(req.body?.amount);
  const note = asNullableString(req.body?.note);

  if (!receiptId || !saleId) {
    return res.status(400).json({ success: false, message: 'ข้อมูลรายการรับชำระหรือบิลขายไม่ถูกต้อง' });
  }

  if (!isPositiveMoney(amount)) {
    return res.status(400).json({ success: false, message: 'ยอดตัดชำระต้องมากกว่า 0' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await ensureEmployeeBelongsToBranchOrThrow(tx, { employeeProfileId, branchId });

      const receipt = await findReceiptOrThrow(tx, { receiptId, branchId });
      if (receipt.status === RECEIPT_STATUS.CANCELLED) {
        const error = new Error('ไม่สามารถตัดชำระจากรายการที่ยกเลิกแล้ว');
        error.statusCode = 409;
        throw error;
      }

      const sale = await findSaleOrThrow(tx, { saleId, branchId });
      if (sale.customerId !== receipt.customerId) {
        const error = new Error('บิลขายและรายการรับชำระต้องเป็นลูกค้ารายเดียวกัน');
        error.statusCode = 409;
        throw error;
      }

      const outstandingAmount = getSaleOutstandingAmount(sale);
      if (outstandingAmount <= 0) {
        const error = new Error('บิลขายนี้ชำระครบแล้ว');
        error.statusCode = 409;
        throw error;
      }

      if (amount > roundMoney(receipt.remainingAmount)) {
        const error = new Error('ยอดตัดชำระมากกว่ายอดคงเหลือของรายการรับชำระ');
        error.statusCode = 409;
        throw error;
      }

      if (amount > outstandingAmount) {
        const error = new Error('ยอดตัดชำระมากกว่ายอดค้างของบิลขาย');
        error.statusCode = 409;
        throw error;
      }

      await tx.customerReceiptAllocation.create({
        data: {
          customerReceiptId: receiptId,
          saleId,
          amount: new Prisma.Decimal(amount),
          note,
          createdByEmployeeProfileId: employeeProfileId,
        },
      });

      const nextAllocatedAmount = roundMoney(receipt.allocatedAmount + amount);
      const nextRemainingAmount = computeRemainingAmount({
        totalAmount: receipt.totalAmount,
        allocatedAmount: nextAllocatedAmount,
      });
      const nextReceiptStatus =
        nextRemainingAmount <= 0 ? RECEIPT_STATUS.FULLY_ALLOCATED : RECEIPT_STATUS.ACTIVE;

      const nextPaidAmount = roundMoney(sale.paidAmount + amount);
      const nextSalePaymentStatus = deriveSalePaymentStatus({
        totalAmount: sale.totalAmount,
        paidAmount: nextPaidAmount,
      });

      await tx.customerReceipt.update({
        where: { id: receiptId },
        data: {
          allocatedAmount: new Prisma.Decimal(nextAllocatedAmount),
          remainingAmount: new Prisma.Decimal(nextRemainingAmount),
          status: nextReceiptStatus,
        },
      });

      await tx.sale.update({
        where: { id: saleId },
        data: {
          paidAmount: new Prisma.Decimal(nextPaidAmount),
          statusPayment: nextSalePaymentStatus,
        },
      });

      const updatedReceipt = await findReceiptOrThrow(tx, { receiptId, branchId });

      return {
        receipt: buildReceiptResponse(updatedReceipt),
        sale: buildSaleAllocationCandidate({
          ...sale,
          paidAmount: nextPaidAmount,
          statusPayment: nextSalePaymentStatus,
        }),
      };
    });

    return res.json({
      success: true,
      message: 'ตัดชำระจากใบรับเงินเรียบร้อยแล้ว',
      data: result,
    });
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error?.message || 'ไม่สามารถตัดชำระได้',
    });
  }
};

const cancelCustomerReceipt = async (req, res) => {
  const branchId = ensureBranchContext(req, res);
  if (!branchId) return;

  const employeeProfileId = ensureEmployeeContext(req, res);
  if (!employeeProfileId) return;

  const receiptId = toInt(req.params?.id);
  const reason = asNullableString(req.body?.reason || req.body?.note);

  if (!receiptId) {
    return res.status(400).json({ success: false, message: 'เลขที่รายการรับชำระไม่ถูกต้อง' });
  }

  if (!reason) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุเหตุผลที่ยกเลิกรายการรับชำระ' });
  }

  try {
    const updatedReceipt = await prisma.$transaction(async (tx) => {
      await ensureEmployeeBelongsToBranchOrThrow(tx, { employeeProfileId, branchId });

      const receipt = await findReceiptOrThrow(tx, { receiptId, branchId });
      if (receipt.status === RECEIPT_STATUS.CANCELLED) {
        const error = new Error('รายการรับชำระนี้ถูกยกเลิกแล้ว');
        error.statusCode = 409;
        throw error;
      }

      for (const allocation of receipt.allocations || []) {
        const sale = await findSaleOrThrow(tx, { saleId: allocation.saleId, branchId });
        const nextPaidAmount = Math.max(roundMoney(sale.paidAmount - allocation.amount), 0);
        const nextSalePaymentStatus = deriveSalePaymentStatus({
          totalAmount: sale.totalAmount,
          paidAmount: nextPaidAmount,
        });

        await tx.sale.update({
          where: { id: sale.id },
          data: {
            paidAmount: new Prisma.Decimal(nextPaidAmount),
            statusPayment: nextSalePaymentStatus,
          },
        });
      }

      await tx.customerReceipt.update({
        where: { id: receiptId },
        data: {
          status: RECEIPT_STATUS.CANCELLED,
          cancelledAt: new Date(),
          cancelledByEmployeeProfileId: employeeProfileId,
          cancelReason: reason,
        },
      });

      return findReceiptOrThrow(tx, { receiptId, branchId });
    });

    return res.json({
      success: true,
      message: 'ยกเลิกรายการรับชำระเรียบร้อยแล้ว',
      data: buildReceiptResponse(updatedReceipt),
    });
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error?.message || 'ไม่สามารถยกเลิกรายการรับชำระได้',
    });
  }
};

module.exports = {
  createCustomerReceipt,
  getCustomerReceiptById,
  searchCustomerReceipts,
  searchCustomerProfiles,
  getAllocationCandidates,
  allocateCustomerReceipt,
  cancelCustomerReceipt,
};