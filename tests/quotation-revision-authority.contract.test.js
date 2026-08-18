'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const includes = (source, token, message) => {
  if (!source.includes(token)) throw new Error(message || `Expected token: ${token}`);
};
const excludes = (source, token, message) => {
  if (source.includes(token)) throw new Error(message || `Unexpected token: ${token}`);
};

const schema = read('prisma/commerce/quotation.prisma');
const migration = read('prisma/migrations/20260819004500_quotation_revision_authority/migration.sql');
const service = read('src/modules/quotation/quotationService.js');
const routes = read('src/modules/quotation/http/quotationRoutes.js');
const issuedSnapshot = read('src/modules/quotation/quotationIssuedSnapshot.js');

for (const token of [
  'REVISION_CREATED',
  'revisionNumber         Int              @default(0)',
  'revisionRootId         Int?',
  'revisedFromId          Int?             @unique',
  '@relation("QuotationRevisionRoot"',
  '@relation("QuotationRevisionChain"',
  '@@unique([branchId, code, revisionNumber])',
]) includes(schema, token, `Quotation revision schema authority missing: ${token}`);

for (const token of [
  'ADD COLUMN "revisionNumber" INTEGER NOT NULL DEFAULT 0',
  'ADD COLUMN "revisionRootId" INTEGER',
  'ADD COLUMN "revisedFromId" INTEGER',
  'Quotation_branchId_code_revisionNumber_key',
  'Quotation_revisedFromId_key',
  'Quotation_revisionRootId_fkey',
  'Quotation_revisedFromId_fkey',
]) includes(migration, token, `Quotation revision migration authority missing: ${token}`);

for (const token of [
  'const createRevision = async (input) => {',
  "['ISSUED', 'ACCEPTED'].includes(source.status)",
  'source.issuedSnapshot',
  'source.revisedTo',
  "'QUOTATION_REVISION_ALREADY_EXISTS'",
  'const nextRevisionNumber = Number(source.revisionNumber || 0) + 1;',
  'const revisionRootId = source.revisionRootId || source.id;',
  'code: source.code,',
  'revisionNumber: nextRevisionNumber,',
  'revisionRootId,',
  'revisedFromId: source.id,',
  'const items = Array.isArray(snapshot.items) ? snapshot.items : [];',
  'await tx.quotationItem.createMany({',
  "eventType: 'REVISION_CREATED'",
  'const revisionHistory = async (input) => {',
]) includes(service, token, `Quotation revision service authority missing: ${token}`);

includes(routes, "router.get('/:quotationId/revisions'", 'Revision history route is required');
includes(routes, "router.post('/:quotationId/revisions'", 'Revision creation route is required');

for (const token of [
  'schemaVersion: 3',
  'revisionNumber: Number(quotation.revisionNumber || 0)',
  'revisionRootId: quotation.revisionRootId || quotation.id',
  'revisedFromId: quotation.revisedFromId || null',
]) includes(issuedSnapshot, token, `Issued snapshot must freeze revision identity: ${token}`);

excludes(service, "quotation.status = 'DRAFT'", 'Revision flow must never unlock the issued source row in place');

console.log('Quotation Revision Authority Contract: PASS');
