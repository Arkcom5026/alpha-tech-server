'use strict';

const { prisma } = require('../../../../lib/prisma');

const findByBranchId = (branchId) =>
  prisma.taxIssuerProfile.findUnique({
    where: { branchId: Number(branchId) },
  });

const upsert = ({ branchId, data }) =>
  prisma.taxIssuerProfile.upsert({
    where: { branchId: Number(branchId) },
    create: {
      branchId: Number(branchId),
      ...data,
    },
    update: data,
  });

module.exports = Object.freeze({
  findByBranchId,
  upsert,
});
