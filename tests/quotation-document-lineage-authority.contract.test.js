'use strict';

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const includes = (source, token) => { if (!source.includes(token)) throw new Error(`Missing lineage contract: ${token}`); };

const schema = read('prisma/commerce/sale-quotation-reference.prisma');
const migration = read('prisma/migrations/20260819012000_sale_quotation_reference_authority/migration.sql');
const contract = read('src/modules/sales/completion/contracts/saleCompletionContract.js');
const controller = read('src/modules/sales/completion/controllers/saleCompletionController.js');
const authority = read('src/modules/sales/lineage/saleQuotationReferenceService.js');
const candidates = read('src/modules/quotation/quotationReferenceCandidateService.js');
const delivery = read('src/modules/sales/documents/print/projectSaleDeliveryNoteService.js');
const tax = read('src/modules/tax/sources/sale/registerSaleTaxCandidateService.js');
const quotationRoutes = read('src/modules/quotation/http/quotationRoutes.js');

for (const token of ['model SaleQuotationReference', 'saleId            Int      @unique', 'quotationId', 'quotationCode', 'quotationRevision']) includes(schema, token);
for (const token of ['CREATE TABLE "SaleQuotationReference"', 'SaleQuotationReference_saleId_key', 'SaleQuotationReference_saleId_fkey', 'SaleQuotationReference_quotationId_fkey']) includes(migration, token);
for (const token of [
  'const sourceQuotationId = sale.sourceQuotationId == null',
  "positiveInteger(sale.sourceQuotationId, 'sourceQuotationId')",
  'sourceQuotationId,',
]) includes(contract, token);
for (const token of [
  'ensureSaleQuotationReference',
  "quotation.status !== 'ACCEPTED'",
  'SALE_QUOTATION_REFERENCE_SUPERSEDED',
  'SALE_QUOTATION_REFERENCE_CUSTOMER_MISMATCH',
  'revisedFromId: quotation.id',
  'SALE_QUOTATION_REFERENCE_CONFLICT',
  'customerId: sale.customerId',
]) includes(authority, token);
for (const token of [
  'listAcceptedReferenceCandidates',
  'projectQuotationWorkflowPolicy(customer)',
  'if (!workflow.quotationWorkflowEnabled)',
  'return { ...workflow, candidates: [] };',
  'customerId: normalizedCustomerId',
  "status: 'ACCEPTED'",
  'revisedTo: { is: null }',
]) includes(candidates, token);
if (candidates.indexOf('if (!workflow.quotationWorkflowEnabled)') > candidates.indexOf('prisma.quotation.findMany')) {
  throw new Error('Quotation discovery must skip quotation query when customer workflow is disabled');
}
includes(controller, 'await resolveAcceptedQuotationReference({');
includes(controller, 'customerId: command.sale.customerId');
includes(controller, 'const result = await completeSale');
if (controller.indexOf('await resolveAcceptedQuotationReference({') > controller.indexOf('const result = await completeSale')) {
  throw new Error('Quotation authority must be validated before the sale is committed');
}
includes(controller, 'quotationReference = await ensureSaleQuotationReference');
includes(delivery, 'sourceQuotation: quotationReference ?');
includes(tax, 'sourceQuotation: quotationReference ?');
includes(quotationRoutes, "router.get('/reference-candidates'");
includes(quotationRoutes, "router.get('/:quotationId/lineage'");

if (authority.includes('quotation.items') || authority.includes('QuotationItem')) {
  throw new Error('Document lineage must not copy or compare quotation line items');
}

console.log('Quotation Document Lineage Authority Contract: PASS');
