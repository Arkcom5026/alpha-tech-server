const { prisma } = require('../../../../../../lib/prisma');

const searchAddressEntities = async (query) => {
  const [provinces, districts, subdistricts] = await Promise.all([
    prisma.province.findMany({
      where: { nameTh: { contains: query, mode: 'insensitive' } },
      select: { code: true, nameTh: true, region: true },
      take: 10,
      orderBy: { nameTh: 'asc' },
    }),
    prisma.district.findMany({
      where: { nameTh: { contains: query, mode: 'insensitive' } },
      select: { code: true, nameTh: true, provinceCode: true },
      take: 10,
      orderBy: { nameTh: 'asc' },
    }),
    prisma.subdistrict.findMany({
      where: { nameTh: { contains: query, mode: 'insensitive' } },
      select: { code: true, nameTh: true, districtCode: true, postcode: true },
      take: 10,
      orderBy: { nameTh: 'asc' },
    }),
  ]);

  return { provinces, districts, subdistricts };
};

module.exports = { searchAddressEntities };
