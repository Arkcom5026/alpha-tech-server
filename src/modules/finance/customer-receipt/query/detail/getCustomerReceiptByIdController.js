const { prisma } = require('../../../../../../lib/prisma');
const { ensureBranchContext } = require('../../shared/customerReceiptContext');
const { toInt } = require('../../shared/customerReceiptValue');
const { receiptInclude } = require('../../shared/customerReceiptIncludes');

const roundMoney = (value) => {
  const n = Number(value);
  return Math.round(((Number.isFinite(n) ? n : 0) + Number.EPSILON) * 100) / 100;
};

const normalizeSaleItemForPrint = (saleItem) => {
  if (!saleItem) return saleItem;

  const quantity =
    saleItem?.quantity ?? saleItem?.qty ?? saleItem?.count ?? saleItem?.itemQty ??
    saleItem?.qtyOrdered ?? saleItem?.qtySold ?? saleItem?.quantitySold ??
    saleItem?.productQty ?? 1;

  const unitPriceIncVat =
    saleItem?.unitPriceIncVat ?? saleItem?.unitPrice ?? saleItem?.price ??
    saleItem?.sellingPrice ?? saleItem?.salePrice ?? 0;

  const amount =
    saleItem?.amount ?? saleItem?.total ?? saleItem?.totalAmount ?? saleItem?.lineTotal ??
    saleItem?.subtotal ?? saleItem?.netAmount ?? saleItem?.grandTotal ??
    Number(unitPriceIncVat || 0) * Number(quantity || 0);

  return {
    ...saleItem,
    productName:
      saleItem?.productName || saleItem?.name || saleItem?.description || saleItem?.title ||
      saleItem?.itemName || saleItem?.stockItem?.product?.name || saleItem?.product?.name ||
      saleItem?.product?.productName || saleItem?.product?.title ||
      (saleItem?.stockItem?.productId ? `สินค้า #${saleItem.stockItem.productId}` : '-') || '-',
    productModel:
      saleItem?.productModel || saleItem?.model || saleItem?.stockItem?.product?.productModel ||
      saleItem?.product?.productModel || '',
    quantity: Number(quantity || 0),
    unit:
      saleItem?.unit || saleItem?.unitName || saleItem?.stockItem?.product?.unit?.name ||
      saleItem?.product?.unit?.name || saleItem?.unitObj?.name || 'ชิ้น',
    unitPrice: roundMoney(unitPriceIncVat),
    unitPriceIncVat: roundMoney(unitPriceIncVat),
    price: saleItem?.price != null ? roundMoney(saleItem.price) : roundMoney(unitPriceIncVat),
    amount: roundMoney(amount),
    totalAmount: roundMoney(amount),
    total: roundMoney(amount),
  };
};

const normalizeAllocationSale = (sale) => {
  if (!sale) return null;
  const saleItems = [
    ...(Array.isArray(sale.items) ? sale.items.map(normalizeSaleItemForPrint) : []),
    ...(Array.isArray(sale.simpleItems) ? sale.simpleItems.map(normalizeSaleItemForPrint) : []),
  ];

  return {
    ...sale,
    totalAmount: roundMoney(sale.totalAmount),
    paidAmount: roundMoney(sale.paidAmount),
    outstandingAmount: roundMoney(roundMoney(sale.totalAmount) - roundMoney(sale.paidAmount)),
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
      : allocations.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  );
  const remainingAmount =
    receipt.remainingAmount != null
      ? roundMoney(receipt.remainingAmount)
      : roundMoney(totalAmount - allocatedAmount);

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

    return res.status(200).json({ success: true, data: buildReceiptResponse(receipt) });
  } catch (error) {
    console.error('❌ [getCustomerReceiptById] error:', error);
    return sendError(res, error, 'ไม่สามารถดึงรายละเอียดรายการรับชำระได้');
  }
};

module.exports = { getCustomerReceiptById };
