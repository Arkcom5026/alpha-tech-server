'use strict';

const { prisma } = require('../../../../lib/prisma');

const findByBranchId = (branchId, client = prisma) =>
  client.storeExperienceProfile.findUnique({ where: { branchId } });

const findCapabilityByBranchId = (branchId, client = prisma) =>
  client.partnerStoreCapability.findUnique({ where: { branchId } });

const upsertDraftForBranch = ({ branchId, create, update }, client = prisma) =>
  client.storeExperienceProfile.upsert({
    where: { branchId },
    create: { branchId, status: 'DRAFT', ...create },
    update,
  });

const publishForBranch = (branchId, client = prisma) =>
  client.$transaction(async (tx) => {
    const experience = await tx.storeExperienceProfile.update({
      where: { branchId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        version: { increment: 1 },
      },
    });
    const capability = await tx.partnerStoreCapability.update({
      where: { branchId },
      data: { storefrontEnabled: true },
    });
    return { experience, capability };
  });

const unpublishForBranch = (branchId, client = prisma) =>
  client.$transaction(async (tx) => {
    const experience = await tx.storeExperienceProfile.update({
      where: { branchId },
      data: {
        status: 'DRAFT',
        publishedAt: null,
        version: { increment: 1 },
      },
    });
    const capability = await tx.partnerStoreCapability.update({
      where: { branchId },
      data: { storefrontEnabled: false },
    });
    return { experience, capability };
  });

module.exports = {
  findByBranchId,
  findCapabilityByBranchId,
  upsertDraftForBranch,
  publishForBranch,
  unpublishForBranch,
};
