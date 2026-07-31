const { prisma, Prisma } = require('../../../../../lib/prisma');

const D = (value) => (
  value instanceof Prisma.Decimal
    ? value
    : new Prisma.Decimal(value ?? 0)
);

const findPurchaseReceiptItems = ({ where }) => prisma.purchaseOrderReceiptItem.findMany({
  where,
  include: {
    receipt: {
      include: {
        branch: true,
        supplier: true,
        purchaseOrder: { include: { supplier: true } },
      },
    },
    purchaseOrderItem: {
      include: {
        product: { include: { unit: true } },
      },
    },
    product: {
      include: { unit: true },
    },
  },
  orderBy: { receipt: { receivedAt: 'desc' } },
});

const findPurchaseReceipts = ({ where }) => prisma.purchaseOrderReceipt.findMany({
  where,
  orderBy: { receivedAt: 'desc' },
  select: {
    id: true,
    code: true,
    receivedAt: true,
    statusReceipt: true,
    statusPayment: true,
    totalAmount: true,
    paidAmount: true,
    supplier: { select: { id: true, name: true, isSystem: true } },
    purchaseOrder: {
      select: {
        id: true,
        code: true,
        supplier: { select: { id: true, name: true, isSystem: true } },
      },
    },
    _count: { select: { items: true } },
  },
});

const findReceiptTotals = async ({ receiptIds, productId }) => {
  if (!receiptIds.length) return [];

  return prisma.$queryRaw(
    Prisma.sql`
      SELECT
        i."receiptId" AS "receiptId",
        COUNT(*)::int AS "itemCount",
        COALESCE(SUM((i."quantity") * (i."costPrice")), 0) AS "totalAmount"
      FROM "PurchaseOrderReceiptItem" i
      LEFT JOIN "PurchaseOrderItem" poi ON poi."id" = i."purchaseOrderItemId"
      WHERE i."receiptId" IN (${Prisma.join(receiptIds)})
        ${Number.isFinite(productId)
          ? Prisma.sql`AND COALESCE(i."productId", poi."productId") = ${productId}`
          : Prisma.empty}
      GROUP BY i."receiptId"
    `
  );
};

const findReceiptByIdAndBranch = ({ receiptId, branchId }) => prisma.purchaseOrderReceipt.findFirst({
  where: { id: receiptId, branchId },
  include: {
    branch: true,
    supplier: true,
    purchaseOrder: { include: { supplier: true } },
  },
});

const findReceiptItemsByReceipt = ({ receiptId, branchId }) => prisma.purchaseOrderReceiptItem.findMany({
  where: {
    receiptId,
    receipt: { branchId },
  },
  include: {
    purchaseOrderItem: {
      include: {
        product: { include: { unit: true } },
      },
    },
    product: {
      include: { unit: true },
    },
  },
  orderBy: { id: 'asc' },
});

module.exports = {
  Prisma,
  D,
  findPurchaseReceiptItems,
  findPurchaseReceipts,
  findReceiptTotals,
  findReceiptByIdAndBranch,
  findReceiptItemsByReceipt,
};
