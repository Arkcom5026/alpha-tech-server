const { prisma } = require('../../../../../lib/prisma');

function buildIdentityFilter(query) {
  const value = String(query || '').trim();
  if (!value) return {};
  const contains = { contains: value, mode: 'insensitive' };
  return {
    OR: [
      { email: contains },
      { loginId: contains },
      { customerProfiles: { some: { name: contains } } },
      { customerProfiles: { some: { companyName: contains } } },
      { customerProfiles: { some: { taxId: contains } } },
    ],
  };
}

function listPlatformIdentityOverview({ query, limit = 100 }) {
  return prisma.user.findMany({
    where: {
      role: 'CUSTOMER',
      ...buildIdentityFilter(query),
    },
    select: {
      id: true,
      loginId: true,
      email: true,
      enabled: true,
      createdAt: true,
      lastLoginAt: true,
      customerProfiles: {
        select: {
          id: true,
          branchId: true,
          name: true,
          companyName: true,
          branch: { select: { id: true, name: true, slug: true } },
        },
        orderBy: [{ branchId: 'asc' }, { id: 'asc' }],
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: Math.min(Math.max(Number(limit) || 100, 1), 200),
  });
}

module.exports = { listPlatformIdentityOverview };
