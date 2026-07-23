const { number } = require('../utils/saleReturnMoney');

const buildSaleReturnEligibility = (sale) => ({
  sale: {
    id: sale.id,
    code: sale.code,
    soldAt: sale.soldAt,
    customer: sale.customer,
    totalAmount: number(sale.totalAmount),
  },
  serializedItems: sale.items.map((item) => ({
    saleItemId: item.id,
    stockItemId: item.stockItemId,
    productId: item.stockItem.productId,
    barcode: item.stockItem.barcode,
    productName: item.stockItem.product?.name || '-',
    status: item.stockItem.status,
    soldAt: item.stockItem.soldAt,
    eligibleQuantity: Math.max(0, 1 - number(item.returnedQuantity)),
    eligibleRefund: Math.max(0, number(item.price) - number(item.refundedAmount)),
  })),
  simpleItems: sale.simpleItems.map((item) => ({
    saleItemSimpleId: item.id,
    productId: item.productId,
    productName: item.product?.name || '-',
    simpleLotId: item.simpleLotId,
    soldQuantity: number(item.quantity),
    eligibleQuantity: Math.max(0, number(item.quantity) - number(item.returnedQuantity)),
    eligibleRefund: Math.max(0, number(item.price) - number(item.refundedAmount)),
  })),
  paymentItems: sale.payments.flatMap((payment) => payment.items.map((item) => ({
    paymentItemId: item.id,
    paymentMethod: item.paymentMethod,
    amount: number(item.amount),
  }))),
});

module.exports = { buildSaleReturnEligibility };
