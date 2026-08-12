'use strict';
const { prisma } = require('../../../../lib/prisma');
const { registerSaleTaxCandidate } = require('../sources/sale/registerSaleTaxCandidateService');
const positive = (value, field) => { const parsed = Number(value); if (!Number.isInteger(parsed) || parsed <= 0) { const error = new Error(`${field} is required`); error.code = 'TAX_PUBLICATION_INPUT_INVALID'; error.statusCode = 400; throw error; } return parsed; };
const listSalePublicationGaps = async ({ branchId, limit = 100 }) => {
  branchId = positive(branchId, 'branchId');
  const sales = await prisma.sale.findMany({
    where: {
      branchId, status: { in: ['COMPLETED', 'FINALIZED', 'DELIVERED'] }, statusPayment: 'PAID',
      NOT: { id: { in: (await prisma.taxCandidate.findMany({ where: { branchId, sourceType: 'SALE' }, select: { sourceId: true } })).map((row) => Number(row.sourceId)).filter(Boolean) } },
    },
    select: { id: true, code: true, soldAt: true, totalAmount: true, status: true, statusPayment: true, customer: { select: { name: true, companyName: true, departmentName: true } } },
    orderBy: { soldAt: 'asc' }, take: Math.min(Math.max(Number(limit) || 100, 1), 500),
  });
  return { gaps: sales, total: sales.length };
};
const retrySalePublication = ({ branchId, saleId, actorEmployeeId }) => registerSaleTaxCandidate({ branchId: positive(branchId, 'branchId'), saleId: positive(saleId, 'saleId'), actorEmployeeId: positive(actorEmployeeId, 'actorEmployeeId') });
const retryAllSalePublications = async ({ branchId, actorEmployeeId, limit }) => {
  const result = await listSalePublicationGaps({ branchId, limit }); const outcomes = [];
  for (const sale of result.gaps) { try { const registered = await retrySalePublication({ branchId, saleId: sale.id, actorEmployeeId }); outcomes.push({ saleId: sale.id, ok: true, taxDocumentId: registered.document?.id }); } catch (error) { outcomes.push({ saleId: sale.id, ok: false, code: error.code, message: error.message }); } }
  return { attempted: outcomes.length, succeeded: outcomes.filter((row) => row.ok).length, failed: outcomes.filter((row) => !row.ok).length, outcomes };
};
module.exports = Object.freeze({ listSalePublicationGaps, retrySalePublication, retryAllSalePublications });
