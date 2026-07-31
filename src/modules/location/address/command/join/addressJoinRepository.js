const { prisma } = require('../../../../../../lib/prisma');

const findAddressBySubdistrictCode = async (subdistrictCode) =>
  prisma.subdistrict.findUnique({
    where: { code: String(subdistrictCode) },
    include: { district: { include: { province: true } } },
  });

module.exports = { findAddressBySubdistrictCode };
