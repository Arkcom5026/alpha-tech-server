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

const publishForBranch = (branchId, snapshot, client = prisma) =>
  client.$transaction(async (tx) => {
    const current = await tx.storeExperienceProfile.findUnique({ where: { branchId } });
    const experience = await tx.storeExperienceProfile.update({
      where: { branchId },
      data: {
        status: 'PUBLISHED',
        publishedThemePreset: snapshot.publishedThemePreset,
        publishedThemeTokens: snapshot.publishedThemeTokens,
        publishedLayoutPreset: snapshot.publishedLayoutPreset,
        publishedSectionConfiguration: snapshot.publishedSectionConfiguration,
        publishedContentConfiguration: snapshot.publishedContentConfiguration,
        publishedVersion: Number(current?.publishedVersion || 0) + 1,
        publishedAt: new Date(),
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
    const experience = await tx.storeExperienceProfile.findUnique({ where: { branchId } });
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
