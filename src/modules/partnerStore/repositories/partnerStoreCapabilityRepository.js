'use strict'

const { prisma } = require('../../../../lib/prisma')

const capabilityInclude = {
  serviceAreas: {
    orderBy: [{ areaType: 'asc' }, { areaCode: 'asc' }],
  },
}

const findByBranchId = (branchId, client = prisma) =>
  client.partnerStoreCapability.findUnique({
    where: { branchId },
    include: capabilityInclude,
  })

const upsertForBranch = ({ branchId, create, update }, client = prisma) =>
  client.partnerStoreCapability.upsert({
    where: { branchId },
    create: { branchId, ...create },
    update,
    include: capabilityInclude,
  })

const replaceServiceAreas = async ({ capabilityId, serviceAreas }, client = prisma) => {
  await client.partnerStoreServiceArea.deleteMany({ where: { capabilityId } })

  if (serviceAreas.length > 0) {
    await client.partnerStoreServiceArea.createMany({
      data: serviceAreas.map((area) => ({ capabilityId, ...area })),
    })
  }
}

const withTransaction = (handler) => prisma.$transaction(handler)

module.exports = {
  findByBranchId,
  replaceServiceAreas,
  upsertForBranch,
  withTransaction,
}
