const { Prisma } = require('@prisma/client');

const decimal = (value) =>
  new Prisma.Decimal(typeof value === 'string' ? value : Number(value));

const toNumber = (value) =>
  value && typeof value === 'object' && 'toNumber' in value
    ? value.toNumber()
    : Number(value);

const isMoneyLike = (value) =>
  (typeof value === 'number' && !Number.isNaN(value)) ||
  (typeof value === 'string' && /^\d+(\.\d{1,2})?$/.test(value));

const listInclude = {
  supplier: true,
  items: { include: { product: { select: { id: true, name: true } } } },
};

const detailInclude = {
  supplier: true,
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          productType: {
            select: {
              name: true,
              globalProductType: {
                select: { category: { select: { name: true } } },
              },
            },
          },
          brand: { select: { name: true } },
          templateProduct: {
            select: { name: true, unit: { select: { name: true } } },
          },
          unit: { select: { name: true } },
        },
      },
      receipts: { select: { id: true, quantity: true } },
    },
  },
};

const parseStatusCsv = (value) => {
  if (!value) return [];
  const values = Array.isArray(value) ? value : String(value).split(',');
  return values.map((entry) => String(entry).trim().toUpperCase()).filter(Boolean);
};

const normalizeDetail = (purchaseOrder) => ({
  ...purchaseOrder,
  items: (purchaseOrder.items || []).map((item) => {
    const product = item.product || {};
    const receipts = item.receipts || [];
    return {
      ...item,
      receiptItems: receipts,
      receivedQuantity: receipts.reduce(
        (sum, receipt) => sum + toNumber(receipt.quantity),
        0
      ),
      categoryName:
        product.productType?.globalProductType?.category?.name ?? null,
      productTypeName: product.productType?.name ?? null,
      brandName: product.brand?.name ?? null,
      productProfileName: null,
      productTemplateName: product.templateProduct?.name ?? null,
      unitName: product.unit?.name ?? product.templateProduct?.unit?.name ?? null,
      productModel: null,
      productName: product.name ?? null,
    };
  }),
});

async function generatePurchaseOrderCode(client, branchId) {
  const paddedBranch = String(branchId).padStart(2, '0');
  const now = new Date();
  const yymm = `${String(now.getFullYear()).slice(2)}${String(
    now.getMonth() + 1
  ).padStart(2, '0')}`;
  const prefix = `PO-${paddedBranch}${yymm}-`;
  const latest = await client.purchaseOrder.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
  });
  const lastSequence = latest ? Number.parseInt(latest.code.slice(-4), 10) : 0;
  return `${prefix}${String(
    (Number.isNaN(lastSequence) ? 0 : lastSequence) + 1
  ).padStart(4, '0')}`;
}

module.exports = {
  decimal,
  detailInclude,
  generatePurchaseOrderCode,
  isMoneyLike,
  listInclude,
  normalizeDetail,
  parseStatusCsv,
};
