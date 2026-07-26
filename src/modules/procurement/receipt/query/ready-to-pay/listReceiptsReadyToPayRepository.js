const { Prisma } = require('@prisma/client');
const { prisma } = require('../../../../../../lib/prisma');

const normalize = process.env.NORMALIZE_DECIMAL_TO_NUMBER !== '0';
const decimal = (value) => new Prisma.Decimal(typeof value === 'string' ? value : Number(value));
const toNumber = (value) => value?.toNumber ? value.toNumber() : Number(value);

const list = async ({ branchId, startDate, endDate, limit }) => {
  const dateFilter = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));

  const receipts = await prisma.purchaseOrderReceipt.findMany({
    where: {
      branchId,
      statusReceipt: 'COMPLETED',
      statusPayment: { not: 'PAID' },
      receivedAt: Object.keys(dateFilter).length ? dateFilter : undefined,
    },
    include: {
      items: { select: { quantity: true, costPrice: true } },
      purchaseOrder: {
        select: {
          id: true,
          code: true,
          supplier: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              creditLimit: true,
              creditBalance: true,
            },
          },
        },
      },
    },
    orderBy: { receivedAt: 'asc' },
    take: limit ? Number(limit) : undefined,
  });

  const results = await Promise.all(receipts.map(async (receipt) => {
    const totalAmount = receipt.items.reduce(
      (sum, item) => sum.plus(decimal(item.costPrice).times(item.quantity)),
      new Prisma.Decimal(0)
    );
    const paidAgg = await prisma.supplierPaymentReceipt.aggregate({
      _sum: { amountPaid: true },
      where: { receiptId: receipt.id },
    });
    const paidAmount = paidAgg._sum.amountPaid || new Prisma.Decimal(0);
    const remainingAmount = totalAmount.minus(paidAmount);
    const supplier = { ...receipt.purchaseOrder.supplier };
    if (normalize) {
      for (const key of ['creditLimit', 'creditBalance']) {
        if (supplier[key]?.toNumber) supplier[key] = supplier[key].toNumber();
      }
    }
    const output = {
      id: receipt.id,
      code: receipt.code,
      orderCode: receipt.purchaseOrder.code,
      supplier,
      totalAmount,
      paidAmount,
      remainingAmount,
      receivedDate: receipt.receivedAt,
    };
    if (normalize) {
      output.totalAmount = toNumber(totalAmount);
      output.paidAmount = toNumber(paidAmount);
      output.remainingAmount = toNumber(remainingAmount);
    }
    return output;
  }));

  return results.filter((item) => normalize ? item.remainingAmount > 0 : item.remainingAmount.greaterThan(0));
};

module.exports = { list };
