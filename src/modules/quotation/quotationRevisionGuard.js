'use strict';

const { prisma } = require('../../../lib/prisma');
const contract = require('./quotationContract');

const ensureLatestRevision = async ({ quotationId, branchId }, tx = prisma) => {
  const id = contract.positiveInt(quotationId, 'quotationId');
  const scopedBranchId = contract.positiveInt(branchId, 'branchId');
  const quotation = await tx.quotation.findFirst({
    where: { id, branchId: scopedBranchId },
    select: {
      id: true,
      revisedTo: { select: { id: true, revisionNumber: true } },
    },
  });

  if (!quotation) contract.fail('Quotation not found', 'QUOTATION_NOT_FOUND', 404);
  if (quotation.revisedTo) {
    contract.fail(
      `Quotation has been superseded by Rev.${quotation.revisedTo.revisionNumber}`,
      'QUOTATION_REVISION_SUPERSEDED',
      409,
    );
  }
  return quotation;
};

module.exports = Object.freeze({ ensureLatestRevision });
