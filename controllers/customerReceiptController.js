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

const receiptInclude = {
  branch: true,
  customer: true,
  createdByEmployeeProfile: true,
  cancelledByEmployeeProfile: true,
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
    },
    select: { id: true },
  });

  if (!employeeProfile) {
    const error = new Error('ไม่พบพนักงานผู้ทำรายการในสาขานี้');
    error.statusCode = 404;
    throw error;
  }
};

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

const sendError = (res, error, fallbackMessage) => {
  const statusCode = error?.statusCode || 500;

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    return res.status(404).json({
      success: false,
      message: error?.message || 'ไม่พบข้อมูลที่ต้องการ',
    });
  }

  const message = error?.message || fallbackMessage || 'เกิดข้อผิดพลาดภายในระบบ';

  return res.status(statusCode).json({
    success: false,
    message,
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
    const paymentMethod = asNullableString(req.body?.paymentMethod);
    const referenceNo = asNullableString(req.body?.referenceNo);
    const note = asNullableString(req.body?.note);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ customerId ให้ถูกต้อง' });
    }

    if (!isPositiveMoney(totalAmount)) {
      return res.status(400).json({ success: false, message: 'totalAmount ต้องมากกว่า 0' });
    }

    if (!paymentMethod) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ paymentMethod' });
    }

    const createdReceipt = await prisma.$transaction(async (tx) => {
      await ensureEmployeeBelongsToBranchOrThrow(tx, { employeeProfileId, branchId });

      const customer = await tx.customerProfile.findFirst({
        where: { id: customerId },
        select: { id: true },
      });

      if (!customer) {
        const error = new Error('ไม่พบข้อมูลลูกค้าที่ต้องการรับชำระ');
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

const getCustomerReceiptById = async (req, res) => {
  try {
    const branchId = ensureBranchContext(req, res);
    if (!branchId) return;

    const receiptId = toInt(req.params?.id);

    if (!Number.isInteger(receiptId) || receiptId <= 0) {
      return res.status(400).json({ success: false, message: 'receiptId ไม่ถูกต้อง' });
    }

    const receipt = await findReceiptOrThrow(prisma, { receiptId, branchId });

    return res.status(200).json({
      success: true,
      data: buildReceiptResponse(receipt),
    });
  } catch (error) {
    console.error('❌ [getCustomerReceiptById] error:', error);
    return sendError(res, error, 'ไม่สามารถดึงรายละเอียดรายการรับชำระได้');
  }
};

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

      const receipt = await findReceiptOrThrow(tx, { receiptId, branchId });

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

      const saleOutstandingAmount = getSaleOutstandingAmount(sale);

      if (saleOutstandingAmount <= 0) {
        const error = new Error('บิลนี้ถูกชำระครบแล้ว');
        error.statusCode = 400;
        throw error;
      }

      if (amount > saleOutstandingAmount) {
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

      const nextSalePaidAmount = roundMoney(roundMoney(sale.paidAmount || 0) + amount);
      await tx.sale.update({
        where: { id: saleId },
        data: {
          paidAmount: nextSalePaidAmount,
          statusPayment: deriveSalePaymentStatus({
            totalAmount: sale.totalAmount,
            paidAmount: nextSalePaidAmount,
          }),
        },
      });

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

      const updatedReceipt = await tx.customerReceipt.update({
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

      return updatedReceipt;
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

const searchCustomerReceipts = async (req, res) => {
  try {
    const branchId = ensureBranchContext(req, res);
    if (!branchId) return;

    const keyword = asNullableString(req.query?.keyword);
    const status = asNullableString(req.query?.status);
    const customerId = toInt(req.query?.customerId);
    const paymentMethod = asNullableString(req.query?.paymentMethod);
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
        {
          code: {
            contains: keyword,
            mode: 'insensitive',
          },
        },
        {
          referenceNo: {
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
              {
                taxId: {
                  contains: keyword,
                  mode: 'insensitive',
                },
              },
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

module.exports = {
  createCustomerReceipt,
  getCustomerReceiptById,
  allocateCustomerReceipt,
  cancelCustomerReceipt,
  searchCustomersForReceipt,
  searchCustomerReceipts,
  searchAllocationCandidates,
};



