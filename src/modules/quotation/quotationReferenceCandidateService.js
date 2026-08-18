'use strict';

const { prisma } = require('../../../lib/prisma');
const contract = require('./quotationContract');
const {
  projectQuotationWorkflowPolicy,
} = require('../customer/policies/customerQuotationWorkflowPolicy');

const listAcceptedReferenceCandidates = async ({ branchId, customerId }) => {
  const normalizedBranchId = contract.positiveInt(branchId, 'branchId');
  const normalizedCustomerId = contract.positiveInt(customerId, 'customerId');

  const customer = await prisma.customerProfile.findFirst({
    where: { id: normalizedCustomerId, branchId: normalizedBranchId },
    select: { id: true, type: true, quotationWorkflowOverride: true },
  });
  if (!customer) {
    contract.fail('Customer does not belong to this branch', 'QUOTATION_REFERENCE_CUSTOMER_SCOPE_FAILED', 404);
  }

  const workflow = projectQuotationWorkflowPolicy(customer);
  if (!workflow.quotationWorkflowEnabled) {
    return { ...workflow, candidates: [] };
  }

  const candidates = await prisma.quotation.findMany({
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

  return { ...workflow, candidates };
};

module.exports = Object.freeze({ listAcceptedReferenceCandidates });
