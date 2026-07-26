const prismaModule = require('../../../../../lib/prisma');

const prisma = prismaModule?.prisma || prismaModule;

const findStockItemByBarcode = async ({ branchId, barcode }) => prisma.stockItem.findFirst({
  where: {
    branchId,
    barcode: { equals: barcode },
  },
  include: {
    product: {
      include: {
        branchPrice: {
          where: { branchId, isActive: true },
          take: 1,
        },
      },
    },
  },
});

const findSimpleLotByBarcode = async ({ branchId, barcode }) => prisma.simpleLot.findFirst({
  where: {
    branchId,
    barcode: { equals: barcode },
  },
  include: {
    product: {
      include: {
        branchPrice: {
          where: { branchId, isActive: true },
          take: 1,
        },
      },
    },
  },
});

module.exports = {
  findStockItemByBarcode,
  findSimpleLotByBarcode,
};
