'use strict';

const { prisma } = require('../../../../lib/prisma');

const findExperienceUsageByBranchId = (branchId, client = prisma) =>
  client.storeExperienceProfile.findUnique({
    where: { branchId },
    select: {
      contentConfiguration: true,
      publishedContentConfiguration: true,
    },
  });

module.exports = {
  findExperienceUsageByBranchId,
};
