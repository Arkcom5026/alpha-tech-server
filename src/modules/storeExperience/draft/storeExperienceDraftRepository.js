'use strict';

const { prisma } = require('../../../../lib/prisma');

const findByBranchId = (branchId, client = prisma) =>
  client.storeExperienceProfile.findUnique({ where: { branchId } });

const upsertDraftForBranch = ({ branchId, create, update }, client = prisma) =>
  client.storeExperienceProfile.upsert({
    where: { branchId },
    create: { branchId, status: 'DRAFT', ...create },
    update,
  });

module.exports = { findByBranchId, upsertDraftForBranch };
