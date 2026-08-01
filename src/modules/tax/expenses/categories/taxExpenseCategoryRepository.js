'use strict';

const { prisma } = require('../../../../lib/prisma');

const list = ({ branchId, activeOnly = false }) => prisma.taxExpenseCategory.findMany({
  where: { branchId: Number(branchId), ...(activeOnly ? { active: true } : {}) },
  orderBy: [{ active: 'desc' }, { code: 'asc' }],
});

const create = ({ branchId, code, name }) => prisma.taxExpenseCategory.create({
  data: { branchId: Number(branchId), code, name },
});

module.exports = Object.freeze({ create, list });
