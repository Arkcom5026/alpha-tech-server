const { prisma } = require('../../../../../lib/prisma');

async function listProvinces() {
  return prisma.province.findMany({
    select: { code: true, nameTh: true },
    orderBy: { nameTh: 'asc' },
  });
}

async function listDistrictsByProvinceCode(provinceCode) {
  return prisma.district.findMany({
    where: { provinceCode: String(provinceCode) },
    select: { code: true, nameTh: true },
    orderBy: { nameTh: 'asc' },
  });
}

async function listSubdistrictsByDistrictCode(districtCode) {
  return prisma.subdistrict.findMany({
    where: { districtCode: String(districtCode) },
    select: { code: true, nameTh: true, postcode: true },
    orderBy: { nameTh: 'asc' },
  });
}

module.exports = {
  listProvinces,
  listDistrictsByProvinceCode,
  listSubdistrictsByDistrictCode,
};
