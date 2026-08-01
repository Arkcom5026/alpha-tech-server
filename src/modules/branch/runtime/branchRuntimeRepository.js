const { prisma } = require('../../../../lib/prisma');

const ADDRESS_INCLUDE = {
  subdistrict: {
    select: {
      code: true,
      nameTh: true,
      postcode: true,
      district: {
        select: {
          code: true,
          nameTh: true,
          province: { select: { code: true, nameTh: true, region: true } },
        },
      },
    },
  },
};

const list = () => prisma.branch.findMany({ orderBy: { name: 'asc' }, include: ADDRESS_INCLUDE });
const findById = (id) => prisma.branch.findUnique({ where: { id }, include: ADDRESS_INCLUDE });
const findBySlug = (slug) => prisma.branch.findUnique({ where: { slug }, include: ADDRESS_INCLUDE });
const create = (data) => prisma.branch.create({ data });
const update = (id, data) => prisma.branch.update({ where: { id }, data, include: ADDRESS_INCLUDE });
const remove = (id) => prisma.branch.delete({ where: { id } });
const listBasePrices = (branchId) => prisma.branchPrice.findMany({ where: { branchId } });
const createPrices = (data) => prisma.branchPrice.createMany({ data, skipDuplicates: true });

module.exports = {
  ADDRESS_INCLUDE,
  list,
  findById,
  findBySlug,
  create,
  update,
  remove,
  listBasePrices,
  createPrices,
};
