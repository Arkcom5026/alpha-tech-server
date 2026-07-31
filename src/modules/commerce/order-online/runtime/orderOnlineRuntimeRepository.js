const { prisma } = require('../../../../../lib/prisma');

const countOrdersCreatedInRange = ({ client = prisma, branchId, start, end }) => (
  client.orderOnline.count({
    where: { branchId, createdAt: { gte: start, lte: end } },
  })
);

const findBranchPrices = ({ client = prisma, branchId, productIds }) => (
  client.branchPrice.findMany({
    where: { branchId, productId: { in: productIds } },
    select: { productId: true, priceOnline: true, isActive: true },
  })
);

const createOrder = ({ client = prisma, data, include }) => (
  client.orderOnline.create({ data, include })
);

const clearCartByUser = async ({ client = prisma, userId }) => {
  await client.cartItem.deleteMany({ where: { cart: { userId } } });
  await client.cart.deleteMany({ where: { userId } });
};

const runTransaction = (callback, options = { timeout: 20000 }) => (
  prisma.$transaction(callback, options)
);

const findOrders = (args) => prisma.orderOnline.findMany(args);
const findOrderById = ({ orderId, include }) => prisma.orderOnline.findUnique({ where: { id: orderId }, ...(include ? { include } : {}) });
const updateOrderById = ({ orderId, data }) => prisma.orderOnline.update({ where: { id: orderId }, data });
const deleteOrderById = (orderId) => prisma.orderOnline.delete({ where: { id: orderId } });

const findCustomerProfileByUserId = ({ userId, include, select }) => (
  prisma.customerProfile.findUnique({
    where: { userId },
    ...(include ? { include } : {}),
    ...(select ? { select } : {}),
  })
);

const findCustomerProfileFirstByUserId = ({ userId, select }) => (
  prisma.customerProfile.findFirst({ where: { userId }, ...(select ? { select } : {}) })
);

module.exports = {
  prisma,
  countOrdersCreatedInRange,
  findBranchPrices,
  createOrder,
  clearCartByUser,
  runTransaction,
  findOrders,
  findOrderById,
  updateOrderById,
  deleteOrderById,
  findCustomerProfileByUserId,
  findCustomerProfileFirstByUserId,
};
