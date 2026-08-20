'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority');

const APPROVAL = 'ALPHATECH_DOCUMENT_REPLACEMENT_E2E_RUNTIME';
const envPath = path.join(process.cwd(), '.env.restore');
if (!fs.existsSync(envPath)) throw new Error('Missing .env.restore. Wave 7D runtime E2E is Test-DB only.');
dotenv.config({ path: envPath, override: true });

const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
const authorityEnv = { ...process.env };
delete authorityEnv.DATABASE_URL;
delete authorityEnv.DIRECT_URL;
const authority = assertTestDatabaseAuthority({ targetUrl, env: authorityEnv, requiresWriteApproval: true });
if (process.env.DOCUMENT_REPLACEMENT_E2E_RUNTIME_APPROVAL !== APPROVAL) {
  throw new Error(`Set DOCUMENT_REPLACEMENT_E2E_RUNTIME_APPROVAL=${APPROVAL} before running Wave 7D runtime certification.`);
}

process.env.DATABASE_URL = targetUrl;
process.env.DIRECT_URL = targetUrl;
process.env.ALPHATECH_RUNTIME_ENV = 'TEST';

const { prisma } = require('../lib/prisma');
const {
  createSaleDocumentReplacement,
  lockSaleDocumentReplacement,
  replaceSaleDocumentReplacementLines,
} = require('../src/modules/sales/document-replacement/documentReplacementService');
const {
  loadCurrentReplacementPrintProjection,
} = require('../src/modules/sales/document-replacement/documentReplacementPrintProjection');
const {
  loadDocumentPreparationReplacementTaxProjection,
} = require('../src/modules/tax/documents/print/documentPreparationReplacementTaxProjection');

const fail = (message) => {
  const error = new Error(message);
  error.code = 'DOCUMENT_REPLACEMENT_WAVE7D_E2E_FAILED';
  throw error;
};

const positiveInt = (value, name) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) fail(`${name} must be a positive integer`);
  return parsed;
};

const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};

const saleId = positiveInt(argValue('--sale') || process.env.DOCUMENT_REPLACEMENT_E2E_SALE_ID, '--sale');
const branchId = positiveInt(argValue('--branch') || process.env.DOCUMENT_REPLACEMENT_E2E_BRANCH_ID, '--branch');
const actorId = positiveInt(argValue('--actor') || process.env.DOCUMENT_REPLACEMENT_E2E_ACTOR_ID, '--actor');
const preparationId = positiveInt(argValue('--preparation') || process.env.DOCUMENT_REPLACEMENT_E2E_PREPARATION_ID, '--preparation');

const amount = (value) => Number(Number(value || 0).toFixed(2));
const stable = (value) => JSON.stringify(value, (key, item) => {
  if (item && typeof item === 'object' && typeof item.toJSON === 'function') return item.toJSON();
  return item;
});

const snapshotFinancialAuthority = async () => {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true, branchId: true, code: true, officialDocumentNumber: true,
      totalBeforeDiscount: true, totalDiscount: true, vat: true, vatRate: true,
      totalAmount: true, status: true, refCode: true,
    },
  });
  if (!sale || Number(sale.branchId) !== branchId) fail('Fixture sale/branch authority mismatch');
  if (!String(sale.refCode || '').startsWith('DOC-REPL-E2E:')) fail('Refusing non-fixture Sale');

  const preparation = await prisma.saleDocumentPreparation.findUnique({ where: { id: preparationId } });
  if (!preparation || Number(preparation.branchId) !== branchId || String(preparation.sourceId) !== String(saleId)) {
    fail('Fixture preparation authority mismatch');
  }
  if (preparation.status !== 'LOCKED' || !preparation.finalSnapshot) fail('Fixture preparation must be LOCKED');

  const taxDocuments = await prisma.taxDocument.findMany({
    where: {
      branchId,
      candidate: { is: { sourceType: 'DOCUMENT_PREPARATION', sourceId: { startsWith: `${preparationId}:` } } },
    },
    include: { candidate: true, outputVatRecord: true },
    orderBy: { id: 'asc' },
  });
  if (taxDocuments.length !== 2) fail(`Expected 2 fixture TaxDocuments, found ${taxDocuments.length}`);
  if (taxDocuments.some((document) => !document.outputVatRecord)) fail('Every fixture TaxDocument must have OutputVatRecord');

  return {
    sale,
    preparation,
    taxDocuments,
    immutable: stable({
      sale,
      preparationFinalSnapshot: preparation.finalSnapshot,
      taxDocuments: taxDocuments.map((document) => ({
        id: document.id,
        status: document.status,
        documentType: document.documentType,
        documentNumber: document.documentNumber,
        taxInvoiceKind: document.taxInvoiceKind,
        issuedDocumentNumber: document.issuedDocumentNumber,
        subtotalAmount: document.subtotalAmount,
        taxAmount: document.taxAmount,
        totalAmount: document.totalAmount,
        outputVatRecord: document.outputVatRecord,
      })),
    }),
  };
};

const linesFor = (replacementNumber, financialLock) => {
  const inLock = financialLock.portions.find((portion) => portion.portion === 'IN_BUDGET');
  const outLock = financialLock.portions.find((portion) => portion.portion === 'OUT_OF_BUDGET') || null;
  if (!inLock) fail('IN_BUDGET financial lock missing');
  const inTotal = amount(inLock.totalAmount);
  const first = replacementNumber === 1 ? amount(inTotal * 0.625) : amount(inTotal * 0.45);
  const second = amount(inTotal - first);
  const inBudgetLines = [
    { description: `Wave 7D R${replacementNumber} recompose A`, quantity: 1, unitName: 'รายการ', unitPrice: first, amount: first },
    { description: `Wave 7D R${replacementNumber} recompose B`, quantity: 1, unitName: 'รายการ', unitPrice: second, amount: second },
  ];
  const outOfBudgetLines = outLock
    ? [{ description: `Wave 7D R${replacementNumber} service`, quantity: 1, unitName: 'บริการ', unitPrice: amount(outLock.totalAmount), amount: amount(outLock.totalAmount), lineType: 'SERVICE_ONLY' }]
    : [];
  return { inBudgetLines, outOfBudgetLines };
};

const assertPrintAuthority = async ({ replacement, taxDocuments }) => {
  const delivery = await loadCurrentReplacementPrintProjection({ prisma, branchId, preparationId });
  if (!delivery || Number(delivery.replacementId) !== Number(replacement.id)) fail('Delivery Note projection did not use current replacement');
  if (amount(delivery.totals.sourceTotal) !== amount(replacement.financialLock.source.sourceTotal)) fail('Delivery Note source total drift');

  const tax = [];
  for (const document of taxDocuments) {
    const projection = await loadDocumentPreparationReplacementTaxProjection({ prisma, branchId, document });
    if (!projection.replacement || Number(projection.replacement.replacementId) !== Number(replacement.id)) {
      fail(`TaxDocument ${document.id} did not use current replacement`);
    }
    const projectedTotal = amount(projection.lines.reduce((sum, line) => sum + Number(line.lineAmount || 0), 0));
    if (projectedTotal !== amount(document.totalAmount)) fail(`TaxDocument ${document.id} projection total drift`);
    if (!projection.lines.every((line) => line.replacementLine === true)) fail(`TaxDocument ${document.id} did not expose replacement lines`);
    tax.push({
      taxDocumentId: document.id,
      portion: projection.portion,
      replacementId: projection.replacement.replacementId,
      lineCount: projection.lines.length,
      projectedTotal,
      issuedDocumentNumber: document.issuedDocumentNumber,
      taxPeriodId: document.outputVatRecord?.taxPeriodId || null,
    });
  }
  return { delivery, tax };
};

async function certifyReplacement(number, baseline) {
  const created = await createSaleDocumentReplacement({
    prisma, branchId, saleId, actorEmployeeId: actorId,
    reason: `Wave 7D runtime E2E replacement ${number}`,
  });
  if (created.replayed) fail(`Replacement ${number} unexpectedly replayed on first create`);
  if (Number(created.replacement.replacementNumber) !== number) fail(`Replacement number ${number} was not allocated`);

  const createReplay = await createSaleDocumentReplacement({
    prisma, branchId, saleId, actorEmployeeId: actorId,
    reason: `Wave 7D runtime E2E replacement ${number} replay`,
  });
  if (!createReplay.replayed || Number(createReplay.replacement.id) !== Number(created.replacement.id)) {
    fail(`Replacement ${number} create replay failed`);
  }

  const nextLines = linesFor(number, created.replacement.financialLock);
  const edited = await replaceSaleDocumentReplacementLines({
    prisma, branchId, saleId, actorEmployeeId: actorId,
    inBudgetLines: nextLines.inBudgetLines,
    outOfBudgetLines: nextLines.outOfBudgetLines,
  });
  if (edited.status !== 'DRAFT') fail(`Replacement ${number} stopped being DRAFT before lock`);

  const locked = await lockSaleDocumentReplacement({ prisma, branchId, saleId, actorEmployeeId: actorId });
  if (locked.replayed || locked.replacement.status !== 'LOCKED') fail(`Replacement ${number} first lock failed`);
  if (!locked.replacement.finalSnapshot) fail(`Replacement ${number} missing immutable finalSnapshot`);

  const lockReplay = await lockSaleDocumentReplacement({ prisma, branchId, saleId, actorEmployeeId: actorId });
  if (!lockReplay.replayed || Number(lockReplay.replacement.id) !== Number(locked.replacement.id)) {
    fail(`Replacement ${number} lock replay failed`);
  }

  const projections = await assertPrintAuthority({ replacement: locked.replacement, taxDocuments: baseline.taxDocuments });
  const after = await snapshotFinancialAuthority();
  if (after.immutable !== baseline.immutable) fail(`Financial/tax authority changed during replacement ${number}`);

  return {
    replacement: locked.replacement,
    supersededReplacementId: locked.supersededReplacementId || null,
    projections,
  };
}

async function main() {
  const existing = await prisma.saleDocumentReplacement.count({ where: { preparationId } });
  if (existing !== 0) fail(`Fixture already has ${existing} replacement row(s); provision a fresh fixture before Wave 7D E2E`);

  const baseline = await snapshotFinancialAuthority();
  const first = await certifyReplacement(1, baseline);
  if (first.supersededReplacementId != null) fail('Replacement #1 must not supersede another replacement');

  const second = await certifyReplacement(2, baseline);
  if (Number(second.supersededReplacementId) !== Number(first.replacement.id)) fail('Replacement #2 did not supersede replacement #1');
  if (Number(second.replacement.replacesReplacementId) !== Number(first.replacement.id)) fail('Replacement #2 lineage does not point to replacement #1');

  const history = await prisma.saleDocumentReplacement.findMany({
    where: { preparationId },
    orderBy: { replacementNumber: 'asc' },
    select: {
      id: true, replacementNumber: true, replacesReplacementId: true, status: true,
      draftKey: true, currentKey: true, lockedAt: true, supersededAt: true, finalSnapshot: true,
    },
  });
  if (history.length !== 2) fail(`Expected 2 replacement history rows, found ${history.length}`);
  if (history[0].status !== 'SUPERSEDED' || !history[0].supersededAt || history[0].currentKey) fail('Replacement #1 supersede history invalid');
  if (history[1].status !== 'LOCKED' || !history[1].currentKey || history[1].draftKey) fail('Replacement #2 current authority invalid');
  if (!history.every((item) => item.finalSnapshot)) fail('Every locked replacement must retain finalSnapshot');

  const finalAuthority = await snapshotFinancialAuthority();
  if (finalAuthority.immutable !== baseline.immutable) fail('Final Sale/Preparation/Tax/Output VAT authority drifted');

  console.log(JSON.stringify({
    result: 'PASS',
    environment: 'TEST',
    databaseModified: true,
    authority: {
      host: authority.target.host,
      port: authority.target.port,
      database: authority.target.database,
      projectRef: authority.target.projectRef,
    },
    fixture: { saleId, branchId, actorId, preparationId },
    replacement1: {
      id: first.replacement.id,
      status: history[0].status,
      replacementNumber: first.replacement.replacementNumber,
      supersededAt: history[0].supersededAt,
    },
    replacement2: {
      id: second.replacement.id,
      status: history[1].status,
      replacementNumber: second.replacement.replacementNumber,
      replacesReplacementId: second.replacement.replacesReplacementId,
      currentKey: history[1].currentKey,
    },
    deliveryNoteCurrentReplacementId: second.projections.delivery.replacementId,
    taxProjections: second.projections.tax,
    invariants: {
      saleUnchanged: true,
      preparationSnapshotUnchanged: true,
      taxDocumentsUnchanged: true,
      outputVatUnchanged: true,
      taxPeriodUnchanged: true,
      createReplay: true,
      lockReplay: true,
      lineage: true,
      supersede: true,
    },
    retainedTestData: true,
  }, null, 2));
  console.log('Document replacement Wave 7D runtime E2E certification: PASS');
}

main()
  .catch((error) => {
    console.error(`${error.code || 'DOCUMENT_REPLACEMENT_WAVE7D_E2E_FAILED'}: ${error.message || error}`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
