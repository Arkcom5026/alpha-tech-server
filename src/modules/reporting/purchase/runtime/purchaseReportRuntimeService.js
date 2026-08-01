const { Prisma } = require('../../../../../lib/prisma');
const repository = require('./purchaseReportRuntimeRepository');

const D = (value) => (
  value instanceof Prisma.Decimal
    ? value
    : new Prisma.Decimal(value ?? 0)
);

const toInt = (value) => (
  value === undefined || value === null || value === ''
    ? undefined
    : Number.parseInt(value, 10)
);

const startOfDay = (value) => new Date(new Date(value).setHours(0, 0, 0, 0));
const endOfDay = (value) => new Date(new Date(value).setHours(23, 59, 59, 999));

const buildFiltersResponse = ({ branchId, query = {} }) => ({
  branchId,
  dateFrom: query.dateFrom ? startOfDay(query.dateFrom) : null,
  dateTo: query.dateTo ? endOfDay(query.dateTo) : null,
  supplierId: toInt(query.supplierId) || null,
  productId: toInt(query.productId) || null,
  receiptStatus: query.receiptStatus || null,
  paymentStatus: query.paymentStatus || null,
});

const buildReceiptWhere = ({ branchId, query = {} }) => {
  const supplierId = toInt(query.supplierId);
  const productId = toInt(query.productId);

  return {
    branchId,
    receivedAt: {
      gte: query.dateFrom ? startOfDay(query.dateFrom) : undefined,
      lte: query.dateTo ? endOfDay(query.dateTo) : undefined,
    },
    statusReceipt:
      query.receiptStatus && query.receiptStatus !== 'all'
        ? query.receiptStatus
        : undefined,
    statusPayment:
      query.paymentStatus && query.paymentStatus !== 'all'
        ? query.paymentStatus
        : undefined,
    ...(productId
      ? {
          items: {
            some: {
              OR: [
                { productId },
                { purchaseOrderItem: { productId } },
              ],
            },
          },
        }
      : {}),
    OR: supplierId
      ? [
          {
            purchaseOrder: {
              supplier: { isSystem: false, id: supplierId },
            },
          },
          {
            supplier: { isSystem: false, id: supplierId },
          },
        ]
      : [
          { purchaseOrder: { supplier: { isSystem: false } } },
          { supplier: { isSystem: false } },
        ],
  };
};

const getPurchaseReport = async ({ branchId, query = {} }) => {
  const supplierId = toInt(query.supplierId);
  const productId = toInt(query.productId);

  const where = {
    receipt: {
      branchId,
      receivedAt: {
        gte: query.dateFrom ? startOfDay(query.dateFrom) : undefined,
        lte: query.dateTo ? endOfDay(query.dateTo) : undefined,
      },
      statusReceipt:
        query.receiptStatus && query.receiptStatus !== 'all'
          ? query.receiptStatus
          : undefined,
      statusPayment:
        query.paymentStatus && query.paymentStatus !== 'all'
          ? query.paymentStatus
          : undefined,
      OR: [
        {
          purchaseOrder: {
            supplier: {
              isSystem: false,
              id: supplierId,
            },
          },
        },
        {
          supplier: {
            isSystem: false,
            id: supplierId,
          },
        },
      ],
    },
    ...(productId
      ? {
          OR: [
            { productId },
            { purchaseOrderItem: { productId } },
          ],
        }
      : {}),
  };

  const receiptItems = await repository.findPurchaseReceiptItems(where);

  const data = receiptItems.map((item) => {
    const quantity = D(item.quantity);
    const costPrice = D(item.costPrice);
    const totalCost = quantity.times(costPrice);
    const product = item.purchaseOrderItem?.product || item.product;

    return {
      receiptId: item.receipt.id,
      receiptCode: item.receipt.code,
      receiptDate: item.receipt.receivedAt,
      receiptStatus: item.receipt.statusReceipt,
      paymentStatus: item.receipt.statusPayment,
      poCode: item.receipt.purchaseOrder?.code || null,
      supplierName:
        item.receipt.purchaseOrder?.supplier?.name ||
        item.receipt.supplier?.name ||
        'N/A',
      branchName: item.receipt.branch.name,
      productName: product?.name || 'N/A',
      quantity: Number(quantity),
      unitName: product?.unit?.name || 'N/A',
      costPrice: Number(costPrice),
      totalCost: Number(totalCost),
    };
  });

  const totalAmount = receiptItems.reduce(
    (sum, item) => sum.plus(D(item.quantity).times(D(item.costPrice))),
    new Prisma.Decimal(0)
  );

  return {
    status: 200,
    body: {
      message: 'Successfully fetched purchase report.',
      data,
      summary: {
        totalAmount: Number(totalAmount),
        totalItems: receiptItems.reduce(
          (sum, item) => sum + Number(item.quantity || 0),
          0
        ),
        uniqueReceipts: new Set(receiptItems.map((item) => item.receipt.code)).size,
      },
      filters: buildFiltersResponse({ branchId, query }),
    },
  };
};

const getPurchaseReceiptReport = async ({ branchId, query = {} }) => {
  const receipts = await repository.findPurchaseReceipts(
    buildReceiptWhere({ branchId, query })
  );

  if (receipts.length === 0) {
    return {
      status: 200,
      body: {
        message: 'Successfully fetched purchase receipt report.',
        data: [],
        summary: { receiptCount: 0, itemCount: 0, totalAmount: 0 },
        filters: buildFiltersResponse({ branchId, query }),
      },
    };
  }

  const totalsRows = await repository.findReceiptTotals({
    receiptIds: receipts.map((receipt) => receipt.id),
    productId: toInt(query.productId),
  });

  const totalsMap = new Map(
    (totalsRows || []).map((row) => [
      Number(row.receiptId),
      {
        itemCount: Number(row.itemCount ?? 0),
        totalAmount: D(row.totalAmount),
      },
    ])
  );

  const data = receipts.map((receipt) => {
    const totals = totalsMap.get(receipt.id) || {
      itemCount: receipt._count?.items || 0,
      totalAmount: D(0),
    };
    const effectiveTotal =
      receipt.totalAmount != null ? D(receipt.totalAmount) : totals.totalAmount;

    return {
      receiptId: receipt.id,
      receiptCode: receipt.code,
      receiptDate: receipt.receivedAt,
      receiptStatus: receipt.statusReceipt,
      paymentStatus: receipt.statusPayment,
      supplierName:
        receipt.purchaseOrder?.supplier?.name || receipt.supplier?.name || 'N/A',
      poCode: receipt.purchaseOrder?.code || null,
      itemCount: totals.itemCount,
      totalAmount: Number(effectiveTotal),
      paidAmount: Number(D(receipt.paidAmount)),
    };
  });

  const totalAmount = data.reduce(
    (sum, item) => sum.plus(D(item.totalAmount)),
    new Prisma.Decimal(0)
  );

  return {
    status: 200,
    body: {
      message: 'Successfully fetched purchase receipt report.',
      data,
      summary: {
        receiptCount: data.length,
        itemCount: data.reduce(
          (sum, item) => sum + Number(item.itemCount || 0),
          0
        ),
        totalAmount: Number(totalAmount),
      },
      filters: buildFiltersResponse({ branchId, query }),
    },
  };
};

const getPurchaseReceiptReportDetail = async ({ branchId, receiptId }) => {
  const normalizedReceiptId = toInt(receiptId);
  if (!normalizedReceiptId) {
    return { status: 400, body: { message: 'receiptId ไม่ถูกต้อง' } };
  }

  const receipt = await repository.findReceiptByIdAndBranch({
    receiptId: normalizedReceiptId,
    branchId,
  });

  if (!receipt) {
    return { status: 404, body: { message: 'ไม่พบใบรับสินค้าที่ต้องการ' } };
  }

  const receiptItems = await repository.findReceiptItemsByReceipt({
    receiptId: normalizedReceiptId,
    branchId,
  });

  const items = receiptItems.map((item) => {
    const quantity = D(item.quantity);
    const costPrice = D(item.costPrice);
    const totalCost = quantity.times(costPrice);
    const product = item.purchaseOrderItem?.product || item.product;

    return {
      id: item.id,
      productId: item.productId,
      productName: product?.name || 'N/A',
      quantity: Number(quantity),
      unitName: product?.unit?.name || 'N/A',
      costPrice: Number(costPrice),
      totalCost: Number(totalCost),
    };
  });

  const computedTotal = items.reduce(
    (sum, item) => sum.plus(D(item.totalCost)),
    new Prisma.Decimal(0)
  );
  const effectiveTotal =
    receipt.totalAmount != null ? D(receipt.totalAmount) : computedTotal;

  return {
    status: 200,
    body: {
      message: 'Successfully fetched purchase receipt report detail.',
      receipt: {
        receiptId: receipt.id,
        receiptCode: receipt.code,
        receiptDate: receipt.receivedAt,
        receiptStatus: receipt.statusReceipt,
        paymentStatus: receipt.statusPayment,
        poCode: receipt.purchaseOrder?.code || null,
        supplierName:
          receipt.purchaseOrder?.supplier?.name || receipt.supplier?.name || 'N/A',
        branchName: receipt.branch?.name || 'N/A',
        totalAmount: Number(effectiveTotal),
        paidAmount: Number(D(receipt.paidAmount)),
      },
      items,
      summary: {
        itemCount: items.length,
        totalAmount: Number(effectiveTotal),
      },
    },
  };
};

module.exports = {
  getPurchaseReport,
  getPurchaseReceiptReport,
  getPurchaseReceiptReportDetail,
};
