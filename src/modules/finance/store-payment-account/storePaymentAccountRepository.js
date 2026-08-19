'use strict';

const { prisma } = require('../../../../lib/prisma');

const listByBranch = (branchId, { includeInactive = false } = {}) => prisma.storePaymentAccount.findMany({
  where: {
    branchId,
    ...(includeInactive ? {} : { isActive: true }),
  },
  orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }, { id: 'asc' }],
});

const findByBranchAndId = (branchId, id) => prisma.storePaymentAccount.findFirst({
  where: { branchId, id },
});

const create = (data) => prisma.storePaymentAccount.create({ data });

const updateByBranchAndId = (branchId, id, data) => prisma.storePaymentAccount.update({
  where: { branchId_id: { branchId, id } },
  data,
});

module.exports = {
  create,
  findByBranchAndId,
  listByBranch,
  updateByBranchAndId,
};
