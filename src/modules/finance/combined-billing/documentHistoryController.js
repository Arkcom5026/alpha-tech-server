'use strict';
const { prisma } = require('../../../../lib/prisma');
const positive = (value) => { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : null; };
const customerInclude = { user: true, subdistrict: { include: { district: { include: { province: true } } } } };
const enrich = async (documents, branchId) => {
  const ids = documents.map((document) => String(document.id));
  const candidates = ids.length ? await prisma.taxCandidate.findMany({ where: { branchId, sourceType: 'CONSOLIDATED_DELIVERY', sourceId: { in: ids } }, select: { sourceId: true, document: { select: { id: true, status: true, taxInvoiceKind: true, issuedDocumentNumber: true } } } }) : [];
  const taxBySource = new Map(candidates.map((candidate) => [candidate.sourceId, candidate.document]));
  return documents.map((document) => ({ ...document, taxDocument: taxBySource.get(String(document.id)) || null }));
};
const list = async (req, res, next) => { try {
  const branchId = positive(req.user?.branchId); if (!branchId) throw Object.assign(new Error('Branch context is required'), { statusCode: 401, code: 'BRANCH_CONTEXT_REQUIRED' });
  const documents = await prisma.combinedBillingDocument.findMany({ where: { branchId, documentLines: { some: {} } }, include: { customer: { include: customerInclude }, documentLines: { select: { id: true, sourceSaleId: true, sourceDocumentNo: true, sourceLineType: true, sourceLineId: true, description: true, documentAmount: true, status: true } } }, orderBy: [{ issueDate: 'desc' }, { id: 'desc' }], take: 100 });
  res.json(await enrich(documents, branchId));
} catch (error) { next(error); } };
const detail = async (req, res, next) => { try {
  const branchId = positive(req.user?.branchId); const id = positive(req.params?.id); if (!branchId || !id) throw Object.assign(new Error('Document identity is invalid'), { statusCode: 400, code: 'CONSOLIDATED_DELIVERY_ID_INVALID' });
  const document = await prisma.combinedBillingDocument.findFirst({ where: { id, branchId, documentLines: { some: {} } }, include: { customer: { include: customerInclude }, employee: true, documentLines: { orderBy: { id: 'asc' } } } });
  if (!document) throw Object.assign(new Error('Consolidated delivery not found'), { statusCode: 404, code: 'CONSOLIDATED_DELIVERY_NOT_FOUND' });
  res.json((await enrich([document], branchId))[0]);
} catch (error) { next(error); } };
const printable = async (req, res, next) => { try {
  const branchId = positive(req.user?.branchId); const id = positive(req.params?.id);
  if (!branchId || !id) throw Object.assign(new Error('Document identity is invalid'), { statusCode: 400, code: 'CONSOLIDATED_DELIVERY_ID_INVALID' });
  const document = await prisma.combinedBillingDocument.findFirst({
    where: { id, branchId, documentLines: { some: {} } },
    include: { customer: { include: customerInclude }, employee: true, branch: true, documentLines: { orderBy: { id: 'asc' } } },
  });
  if (!document) throw Object.assign(new Error('Consolidated delivery not found'), { statusCode: 404, code: 'CONSOLIDATED_DELIVERY_NOT_FOUND' });
  const presentations = await prisma.consolidatedDeliveryLinePresentation.findMany({
    where: { branchId, combinedBillingId: id },
    select: {
      consolidatedDeliveryLineId: true,
      documentPrefix: true,
      documentDescription: true,
      documentSuffix: true,
    },
  });
  const presentationByLineId = new Map(
    presentations.map((presentation) => [presentation.consolidatedDeliveryLineId, presentation]),
  );
  res.json({
    document: { id: document.id, title: 'ใบส่งของรวม', number: document.code, issuedAt: document.issueDate, note: document.note, totalAmount: document.totalAmount },
    customer: document.customer,
    branch: document.branch,
    createdBy: document.employee,
    lines: document.documentLines.map((line) => {
      const presentation = presentationByLineId.get(line.id) || null;
      return {
        id: line.id, sourceDocumentNo: line.sourceDocumentNo, sourceSaleCode: line.sourceSaleCode,
        description: line.description,
        documentPrefix: presentation?.documentPrefix || null,
        documentDescription: presentation?.documentDescription || null,
        documentSuffix: presentation?.documentSuffix || null,
        quantity: line.quantity, sourceUnitPrice: line.sourceUnitPrice,
        documentUnitPrice: line.documentUnitPrice, priceAdjustment: line.priceAdjustment,
        adjustmentReason: line.adjustmentReason, lineAmount: line.documentAmount,
      };
    }),
  });
} catch (error) { next(error); } };
module.exports = { list, detail, printable, enrich };
