'use strict';

const money = (value) => Number(value || 0);
const outstanding = (sale) => Math.max(0, Number((money(sale.totalAmount) - money(sale.paidAmount)).toFixed(2)));

const mapStockLine = (item) => ({
  lineType: 'STOCK',
  saleItemId: item.id,
  description: item.documentDescription || item.stockItem?.product?.name || 'สินค้า',
  quantity: 1,
  unitAmount: money(item.basePrice),
  discountAmount: money(item.discount),
  lineAmount: money(item.price),
  barcode: item.stockItem?.barcode || null,
});

const mapSimpleLine = (item) => ({
  lineType: 'SIMPLE',
  saleItemId: item.id,
  description: item.documentDescription || item.product?.name || 'สินค้า',
  quantity: money(item.quantity),
  unitAmount: money(item.basePrice),
  discountAmount: money(item.discount),
  lineAmount: money(item.price),
  barcode: null,
});

const listEligibleDeliveryCredits = async ({ prisma, command }) => {
  const customer = await prisma.customerProfile.findFirst({
    where: { id: command.customerId, branchId: command.branchId },
    select: { id: true, name: true, companyName: true, taxId: true },
  });
  if (!customer) {
    const error = new Error('ไม่พบลูกค้าในสาขานี้');
    error.code = 'CUSTOMER_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const keyword = command.search;
  const sales = await prisma.sale.findMany({
    where: {
      branchId: command.branchId,
      customerId: command.customerId,
      isCredit: true,
      status: 'COMPLETED',
      statusPayment: { in: ['UNPAID', 'PARTIALLY_PAID'] },
      ...(keyword ? {
        OR: [
          { code: { contains: keyword, mode: 'insensitive' } },
          { officialDocumentNumber: { contains: keyword, mode: 'insensitive' } },
          { refCode: { contains: keyword, mode: 'insensitive' } },
        ],
      } : {}),
    },
    select: {
      id: true,
      code: true,
      officialDocumentNumber: true,
      soldAt: true,
      dueDate: true,
      totalAmount: true,
      paidAmount: true,
      statusPayment: true,
      note: true,
      items: {
        select: {
          id: true,
          basePrice: true,
          discount: true,
          price: true,
          documentDescription: true,
          stockItem: { select: { barcode: true, product: { select: { name: true } } } },
        },
      },
      simpleItems: {
        select: {
          id: true,
          quantity: true,
          basePrice: true,
          discount: true,
          price: true,
          documentDescription: true,
          product: { select: { name: true } },
        },
      },
    },
    orderBy: [{ dueDate: 'asc' }, { soldAt: 'asc' }, { id: 'asc' }],
    take: command.take,
  });

  const balance = await prisma.customerMoneyBalance.findUnique({
    where: { branchId_customerId: { branchId: command.branchId, customerId: command.customerId } },
    select: { id: true, availableAmount: true, updatedAt: true },
  });

  return {
    customer,
    balance: {
      id: balance?.id || null,
      availableAmount: money(balance?.availableAmount),
      updatedAt: balance?.updatedAt || null,
    },
    sales: sales.map((sale) => ({
      id: sale.id,
      code: sale.code,
      documentNo: sale.officialDocumentNumber || sale.code,
      soldAt: sale.soldAt,
      dueDate: sale.dueDate,
      totalAmount: money(sale.totalAmount),
      paidAmount: money(sale.paidAmount),
      outstandingAmount: outstanding(sale),
      statusPayment: sale.statusPayment,
      note: sale.note || null,
      lines: [...sale.items.map(mapStockLine), ...sale.simpleItems.map(mapSimpleLine)],
    })).filter((sale) => sale.outstandingAmount > 0),
  };
};

module.exports = { listEligibleDeliveryCredits, outstanding };
