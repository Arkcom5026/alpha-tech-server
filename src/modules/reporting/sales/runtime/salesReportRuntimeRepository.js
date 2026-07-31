const { prisma, Prisma } = require('../../../../../lib/prisma');

const D = (value) => (value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value ?? 0));
const toNum = (value) => (value && typeof value.toNumber === 'function' ? value.toNumber() : Number(value ?? 0));

const getSaleItemModel = () => (typeof prisma.saleItem?.findMany === 'function' ? prisma.saleItem : null);
const getSalePaymentModel = () => (typeof prisma.payment?.findMany === 'function' ? prisma.payment : null);
const getStockBalanceModel = () => (typeof prisma.stockBalance?.findMany === 'function' ? prisma.stockBalance : null);
const getPurchaseOrderModel = () => (typeof prisma.purchaseOrder?.count === 'function' ? prisma.purchaseOrder : null);

module.exports = {
  prisma,
  D,
  toNum,
  getSaleItemModel,
  getSalePaymentModel,
  getStockBalanceModel,
  getPurchaseOrderModel,
};
