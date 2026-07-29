const {
  toNumber,
  roundMoney,
  computeRemainingAmount,
  getSaleOutstandingAmount,
} = require('./customerReceiptValue');

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
    Number(unitPriceIncVat || 0) * Number(quantity || 0);

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
      unitPriceIncVat != null
        ? roundMoney(unitPriceIncVat)
        : roundMoney(saleItem?.unitPriceIncVat),
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

module.exports = {
  normalizeSaleItemForPrint,
  normalizeAllocationSale,
  buildReceiptResponse,
  buildSaleAllocationCandidate,
};
