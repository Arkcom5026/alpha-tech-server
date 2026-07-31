const { prisma } = require('../../../../../../lib/prisma');

const findSubdistrictPostcodeByCode = async (subdistrictCode) => {
  return prisma.subdistrict.findUnique({
    where: { code: subdistrictCode },
    select: { postcode: true },
  });
};

module.exports = { findSubdistrictPostcodeByCode };
