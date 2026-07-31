const { prisma } = require('../../../../../../lib/prisma');

async function findSubdistrictAggregate(subdistrictCode) {
  return prisma.subdistrict.findUnique({
    where: { code: subdistrictCode },
    include: { district: { include: { province: true } } },
  });
}

module.exports = {
  findSubdistrictAggregate,
};
