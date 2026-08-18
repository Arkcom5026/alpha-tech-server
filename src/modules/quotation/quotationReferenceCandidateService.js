'use strict';

const { prisma } = require('../../../lib/prisma');
const contract = require('./quotationContract');

const listAcceptedReferenceCandidates = async ({ branchId, customerId }) => {
  const normalizedBranchId = contract.positiveInt(branchId, 'branchId');
  const normalizedCustomerId = contract.positiveInt(customerId, 'customerId');

  return prisma.quotation.findMany({
    where: {
      branchId: normalizedBranchId,
      customerId: normalizedCustomerId,
      status: 'ACCEPTED',
      revisedTo: { is: null },
    },
    orderBy: [{ acceptedAt: 'desc' }, { revisionNumber: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      code: true,
      revisionNumber: true,
      customerId: true,
      customerName: true,
      customerCompany: true,
      acceptedAt: true,
      issuedAt: true,
      grandTotal: true,
    },
  });
};

module.exports = Object.freeze({ listAcceptedReferenceCandidates });
