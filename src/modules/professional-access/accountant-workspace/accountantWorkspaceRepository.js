const { prisma } = require('../../../shared/prisma');

const activeWindow = (now) => ({
  AND: [
    { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }] },
    { OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: now } }] },
  ],
});

const activeScopeWhere = (now) => ({
  status: 'ACTIVE',
  ...activeWindow(now),
});

const findActiveMembership = ({ userId, externalOrganizationId }) =>
  prisma.externalOrganizationMembership.findFirst({
    where: {
      userId,
      externalOrganizationId,
      status: 'ACTIVE',
      externalOrganization: {
        status: 'ACTIVE',
        type: 'ACCOUNTING_FIRM',
      },
    },
    select: {
      id: true,
      role: true,
      status: true,
    },
  });

const listActiveAssignments = ({ externalOrganizationId, now }) =>
  prisma.businessAccountingFirmAssignment.findMany({
    where: {
      externalOrganizationId,
      status: 'ACTIVE',
      ...activeWindow(now),
      business: { status: 'ACTIVE' },
    },
    orderBy: [{ business: { name: 'asc' } }, { id: 'asc' }],
    select: {
      id: true,
      effectiveFrom: true,
      effectiveUntil: true,
      business: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
      permissionScopes: {
        where: activeScopeWhere(now),
        select: {
          id: true,
          resource: true,
        },
      },
    },
  });

const findAssignment = ({ externalOrganizationId, businessId, now }) =>
  prisma.businessAccountingFirmAssignment.findFirst({
    where: {
      externalOrganizationId,
      businessId,
    },
    select: {
      id: true,
      status: true,
      effectiveFrom: true,
      effectiveUntil: true,
      business: {
        select: {
          id: true,
          name: true,
          legalName: true,
          taxId: true,
          status: true,
          branches: {
            orderBy: [{ isHeadOffice: 'desc' }, { id: 'asc' }],
            select: {
              id: true,
              name: true,
              branchCode: true,
              isHeadOffice: true,
              taxId: true,
            },
          },
        },
      },
      permissionScopes: {
        where: activeScopeWhere(now),
        orderBy: [{ resource: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          resource: true,
          actions: true,
          branchMode: true,
          branchIds: true,
          constraints: true,
          effectiveFrom: true,
          effectiveUntil: true,
        },
      },
    },
  });

module.exports = {
  findActiveMembership,
  findAssignment,
  listActiveAssignments,
};
