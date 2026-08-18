'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const includes = (source, value, message) => {
  if (!source.includes(value)) throw new Error(message || `Expected source to include: ${value}`);
};
const excludes = (source, value, message) => {
  if (source.includes(value)) throw new Error(message || `Expected source to exclude: ${value}`);
};

const schema = read('prisma/commerce/quotation.prisma');
const migration = read('prisma/migrations/20260818180500_quotation_document_first_e2e/migration.sql');
const service = read('src/modules/quotation/quotationService.js');
const contract = read('src/modules/quotation/quotationContract.js');
const routes = read('src/modules/quotation/http/quotationRoutes.js');
const salesRoutes = read('src/modules/sales/routes/saleRoutes.js');
const createSection = service.slice(service.indexOf('const create = async'), service.indexOf('const list = async'));

includes(schema, 'model Quotation {', 'Quotation must be a first-class document aggregate');
includes(schema, 'items                  QuotationItem[]', 'Quotation must own zero-to-many document lines');
includes(schema, 'customerId             Int?', 'Draft customer linkage must be optional');
includes(schema, 'sourceProductId Int?', 'Product linkage must be optional helper metadata');
includes(schema, 'sourceType      QuotationLineSource @default(MANUAL)', 'Manual lines must be first-class');
includes(schema, 'description     String?', 'Quotation lines must support multiline document descriptions');
includes(schema, 'sortOrder       Int', 'Document line order must be explicit');
includes(schema, 'documentHeaderSnapshot Json?', 'Issued document presentation must be snapshot-capable');
includes(schema, 'customerSnapshot       Json?', 'Issued customer identity must be snapshot-capable');

includes(migration, 'CREATE TABLE "Quotation"', 'Canonical migration must create quotation aggregate');
includes(migration, 'CREATE TABLE "QuotationItem"', 'Canonical migration must create quotation document lines');
includes(migration, '"customerId" INTEGER,', 'Migration must permit customer-less draft creation');
includes(migration, '"sourceProductId" INTEGER,', 'Migration must permit manual lines with no product');

includes(createSection, 'Empty draft created', 'Create authority must explicitly support an empty document draft');
includes(createSection, 'customerId = contract.optionalPositiveInt', 'Customer selection must be optional at creation');
excludes(createSection, 'items.length', 'Draft creation must not require any item count');
excludes(service, 'sourceProductId: contract.positiveInt', 'Product selection must never be required for quotation lines');
includes(service, "ensureDraft(quotation)", 'Document editing must be restricted to draft authority');
includes(service, 'documentHeaderSnapshot', 'Issuing must snapshot document header authority');
includes(service, 'customerSnapshot', 'Issuing must snapshot recipient presentation data');

includes(contract, "sourceType: sourceProductId ? 'PRODUCT_ASSISTED' : 'MANUAL'", 'Line source must derive from optional product assistance');
includes(contract, 'billDiscount: 0,', 'Quotation draft authority must not preserve bill-discount semantics');
includes(contract, 'discountAmount: 0,', 'Quotation line authority must use the offered unit price as the final price');
includes(contract, 'Quotation uses the offered unit price as the final commercial price.', 'Adjusted-price-only semantics must be explicit in the quotation contract');
includes(contract, 'Number.isInteger(parsed)', 'Quotation quantity authority must reject fractional quantities');
includes(contract, 'quantity must be a positive integer', 'Quotation quantity validation must require positive whole numbers');
includes(routes, 'QUOTATION_EMPLOYEE_AUTHORITY_REQUIRED', 'Quotation workspace must reject non-employee authenticated contexts');
includes(routes, 'router.use(requireEmployeeContext);', 'Employee authority must guard all quotation routes');
excludes(routes, "require('../../../../middlewares/verifyToken')", 'Quotation child router must inherit authenticated sales authority instead of verifying the same request twice');
includes(routes, "router.post('/',", 'Empty quotation creation endpoint is required');
includes(routes, "router.post('/:quotationId/items'", 'Manual/document line authoring endpoint is required');
includes(routes, "router.post('/:quotationId/issue'", 'Quotation issue lifecycle endpoint is required');
includes(salesRoutes, 'router.use(verifyToken);', 'Sales parent router must own authentication');
includes(salesRoutes, "router.use('/quotations', quotationRoutes);", 'Quotation API must be mounted under authenticated sales authority');

console.log('Quotation Document-First E2E contract: PASS');
