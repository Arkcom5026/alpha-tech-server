const { prisma } = require('../../../shared/prisma');

const activeWindow = (now) => ({
  AND: [
    { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }] },
    { OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: now } }] },
  ],
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
    select: { id: true, role: true, status: true },
  });

const findActiveAssignment = ({ externalOrganizationId, businessId, now }) =>
  prisma.businessAccountingFirmAssignment.findFirst({
    where: {
      externalOrganizationId,
      businessId,
      status: 'ACTIVE',
      ...activeWindow(now),
      business: { status: 'ACTIVE' },
    },
    select: {
      id: true,
      businessId: true,
      externalOrganizationId: true,
      status: true,
      effectiveFrom: true,
      effectiveUntil: true,
      permissionScopes: {
        where: {
          status: 'ACTIVE',
          resource: 'TAX_REVIEW',
          actions: { hasSome: ['READ', 'COMMENT', 'RESOLVE'] },
          ...activeWindow(now),
        },
        select: {
          id: true,
          status: true,
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

const listReviews = ({ assignmentId, branchId, status }) =>
  prisma.taxReviewSession.findMany({
    where: {
      assignmentId,
      ...(branchId ? { branchId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    include: {
      notes: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    },
  });

const createReview = (data) =>
  prisma.taxReviewSession.create({ data });

const findReview = ({ id, assignmentId }) =>
  prisma.taxReviewSession.findFirst({
    where: { id, assignmentId },
    include: {
      notes: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    },
  });

const addNote = (data) =>
  prisma.taxReviewNote.create({ data });

const updateStatus = ({ id, assignmentId, status, resolvedAt, resolvedByUserId }) =>
  prisma.taxReviewSession.updateMany({
    where: { id, assignmentId },
    data: { status, resolvedAt, resolvedByUserId },
  });

module.exports = {
  addNote,
  createReview,
  findActiveAssignment,
  findActiveMembership,
  findReview,
  listReviews,
  updateStatus,
};
