'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority');

const APPROVAL = 'ALPHATECH_DOCUMENT_REPLACEMENT_E2E_FIXTURE';
const envPath = path.join(process.cwd(), '.env.restore');

if (!fs.existsSync(envPath)) throw new Error('Missing .env.restore.');
dotenv.config({ path: envPath, override: true });

const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
const authorityEnv = { ...process.env };
delete authorityEnv.DATABASE_URL;
delete authorityEnv.DIRECT_URL;
assertTestDatabaseAuthority({ targetUrl, env: authorityEnv, requiresWriteApproval: true });

if (process.env.DOCUMENT_REPLACEMENT_E2E_FIXTURE_APPROVAL !== APPROVAL) {
  throw new Error(`Set DOCUMENT_REPLACEMENT_E2E_FIXTURE_APPROVAL=${APPROVAL} before provisioning fixture data.`);
}

process.env.DATABASE_URL = targetUrl;
process.env.DIRECT_URL = targetUrl;
process.env.ALPHATECH_RUNTIME_ENV = 'TEST';
const { prisma } = require('../lib/prisma');

const gross = Object.freeze({
  sourceTotal: 5000,
  sourceTaxAmount: 327.10,
  inBudget: Object.freeze({ subtotalAmount: 3738.32, taxAmount: 261.68, totalAmount: 4000 }),
  outOfBudget: Object.freeze({ subtotalAmount: 934.58, taxAmount: 65.42, totalAmount: 1000 }),
});

async function main() {
  const runToken = crypto.randomBytes(6).toString('hex').toUpperCase();
  const actor = await prisma.employeeProfile.findFirst({
    where: { branchId: { not: null } },
    orderBy: { id: 'asc' },
    select: { id: true, branchId: true },
  });
  if (!actor?.branchId) throw new Error('Test DB requires at least one employee assigned to a branch.');

  const now = new Date();
  const saleCode = `DRE2E-${runToken}`;
  const deliveryNoteNumber = `DN-E2E-${runToken}`;
  const taxPeriodId = `DOC-REPL-E2E-${runToken}`;
  const periodCode = `DRE2E-${runToken}`;

  const fixture = await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        code: saleCode,
        soldAt: now,
        employeeId: actor.id,
        branchId: actor.branchId,
        totalBeforeDiscount: gross.sourceTotal,
        totalDiscount: 0,
        vat: gross.sourceTaxAmount,
        vatRate: 7,
        totalAmount: gross.sourceTotal,
        note: 'SYSTEM TEST ONLY — document replacement financial lock E2E fixture',
        refCode: `DOC-REPL-E2E:${runToken}`,
        isTaxInvoice: true,
        officialDocumentNumber: deliveryNoteNumber,
        status: 'COMPLETED',
        paid: true,
        paidAmount: gross.sourceTotal,
        statusPayment: 'PAID',
      },
      select: { id: true, branchId: true, employeeId: true, code: true, officialDocumentNumber: true, refCode: true },
    });

    const preparation = await tx.saleDocumentPreparation.create({
      data: {
        branchId: sale.branchId,
        sourceType: 'SALE',
        sourceId: String(sale.id),
        status: 'DRAFT',
        sourceTotal: gross.sourceTotal,
        documentTotal: gross.inBudget.totalAmount,
        agencyContext: { fixture: 'DOCUMENT_REPLACEMENT_FINANCIAL_LOCK_E2E', runToken },
        createdById: actor.id,
        updatedById: actor.id,
      },
      select: { id: true, branchId: true },
    });

    const finalSnapshot = {
      schemaVersion: 1,
      preparationId: preparation.id,
      source: {
        sourceType: 'SALE',
        saleId: sale.id,
        saleCode: sale.code,
        deliveryNoteNumber: sale.officialDocumentNumber,
        totalAmount: gross.sourceTotal,
        taxAmount: gross.sourceTaxAmount,
        vatRate: 7,
      },
      totals: {
        sourceTotal: gross.sourceTotal,
        documentTotal: gross.inBudget.totalAmount,
        outOfBudgetTotal: gross.outOfBudget.totalAmount,
      },
      lines: [
        { description: 'Original agency goods', quantity: 1, unitName: 'ชุด', unitPrice: 4000, amount: 4000, sortOrder: 0 },
      ],
      outOfBudgetService: {
        description: 'ค่าบริการ', quantity: 1, unitName: 'งาน', unitPrice: 1000, amount: 1000, lineType: 'SERVICE_ONLY', sortOrder: 0,
      },
      taxProjection: [
        { portion: 'IN_BUDGET', taxInvoiceKind: 'FULL', lineType: 'MANUAL_DOCUMENT_LINES', totalAmount: gross.inBudget.totalAmount },
        { portion: 'OUT_OF_BUDGET', taxInvoiceKind: 'SHORT', lineType: 'SERVICE_ONLY', totalAmount: gross.outOfBudget.totalAmount },
      ],
      vatAllocation: [
        { portion: 'IN_BUDGET', ...gross.inBudget },
        { portion: 'OUT_OF_BUDGET', ...gross.outOfBudget },
      ],
      lockedAt: now.toISOString(),
      lockedById: actor.id,
    };

    await tx.saleDocumentPreparation.update({
      where: { id: preparation.id },
      data: {
        status: 'LOCKED',
        finalSnapshot,
        lockedById: actor.id,
        lockedAt: now,
        lines: {
          create: [{ description: 'Original agency goods', quantity: 1, unitName: 'ชุด', unitPrice: 4000, amount: 4000, sortOrder: 0 }],
        },
      },
    });

    await tx.taxPeriod.create({
      data: {
        id: taxPeriodId,
        branchId: sale.branchId,
        periodCode,
        startDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        endDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)),
        status: 'OPEN',
      },
    });

    const createTaxAuthority = async ({ portion, kind, values, sequence }) => {
      const sourceId = `${preparation.id}:${portion}`;
      const candidate = await tx.taxCandidate.create({
        data: {
          branchId: sale.branchId,
          sourceType: 'DOCUMENT_PREPARATION',
          sourceId,
          sourceDocumentNo: sale.officialDocumentNumber,
          registrationKey: `DOC-REPL-E2E:${runToken}:${portion}`,
          status: 'REGISTERED',
          occurredAt: now,
          snapshot: { fixture: true, preparationId: preparation.id, portion, sourceSaleId: sale.id },
          mappedDocumentType: kind === 'FULL' ? 'TAX_INVOICE' : 'ABBREVIATED_TAX_INVOICE',
        },
        select: { id: true },
      });
      const issuedDocumentNumber = `${kind}-E2E-${runToken}-${sequence}`;
      const document = await tx.taxDocument.create({
        data: {
          branchId: sale.branchId,
          candidateId: candidate.id,
          documentType: kind === 'FULL' ? 'TAX_INVOICE' : 'ABBREVIATED_TAX_INVOICE',
          documentNumber: issuedDocumentNumber,
          identityKey: `DOC-REPL-E2E:${runToken}:TAX:${portion}`,
          status: 'REGISTERED',
          issuedAt: now,
          occurredAt: now,
          subtotalAmount: values.subtotalAmount,
          taxAmount: values.taxAmount,
          totalAmount: values.totalAmount,
          taxInvoiceKind: kind,
          issuedDocumentNumber,
          snapshot: {
            fixture: true,
            preparationId: preparation.id,
            portion,
            sourceSaleId: sale.id,
            sourceSaleCode: sale.code,
            sourceDeliveryNoteNumber: sale.officialDocumentNumber,
            items: portion === 'IN_BUDGET'
              ? [{ description: 'Original agency goods', quantity: 1, unitName: 'ชุด', unitPrice: 4000, amount: 4000 }]
              : [{ description: 'ค่าบริการ', quantity: 1, unitName: 'งาน', unitPrice: 1000, amount: 1000 }],
          },
        },
        select: { id: true, taxInvoiceKind: true, issuedDocumentNumber: true },
      });
      await tx.outputVatRecord.create({
        data: {
          branchId: sale.branchId,
          taxDocumentId: document.id,
          taxPeriodId,
          ledgerType: 'OUTPUT_VAT',
          replayKey: `DOC-REPL-E2E:${runToken}:VAT:${portion}`,
          documentType: kind === 'FULL' ? 'TAX_INVOICE' : 'ABBREVIATED_TAX_INVOICE',
          taxInvoiceKind: kind,
          documentNumber: issuedDocumentNumber,
          issuedDocumentNumber,
          documentDate: now,
          subtotalAmount: values.subtotalAmount,
          taxAmount: values.taxAmount,
          totalAmount: values.totalAmount,
          issuerSnapshot: { fixture: true, runToken },
          documentSnapshot: { fixture: true, preparationId: preparation.id, portion, sourceSaleId: sale.id },
        },
      });
      return document;
    };

    const fullTaxDocument = await createTaxAuthority({ portion: 'IN_BUDGET', kind: 'FULL', values: gross.inBudget, sequence: 1 });
    const shortTaxDocument = await createTaxAuthority({ portion: 'OUT_OF_BUDGET', kind: 'SHORT', values: gross.outOfBudget, sequence: 2 });

    return { sale, preparation, actor, taxPeriodId, fullTaxDocument, shortTaxDocument };
  });

  const env = {
    DOCUMENT_REPLACEMENT_E2E_SALE_ID: fixture.sale.id,
    DOCUMENT_REPLACEMENT_E2E_BRANCH_ID: fixture.sale.branchId,
    DOCUMENT_REPLACEMENT_E2E_ACTOR_ID: fixture.actor.id,
    DOCUMENT_REPLACEMENT_E2E_PREPARATION_ID: fixture.preparation.id,
  };

  console.log(JSON.stringify({
    result: 'PASS',
    environment: 'TEST',
    fixture: {
      runToken,
      sale: fixture.sale,
      preparationId: fixture.preparation.id,
      actorId: fixture.actor.id,
      taxPeriodId: fixture.taxPeriodId,
      taxDocuments: [fixture.fullTaxDocument, fixture.shortTaxDocument],
    },
    powershell: Object.entries(env).map(([key, value]) => `$env:${key} = "${value}"`),
    retainedTestData: true,
    safety: 'Fresh Test-DB-only sale/tax fixture. Production authority is blocked by testDatabaseAuthority.',
  }, null, 2));
  console.log('Document replacement Wave 7D fixture provision: PASS');
}

main()
  .catch((error) => {
    console.error(`DOCUMENT_REPLACEMENT_WAVE7D_FIXTURE_FAILED: ${error.message || error}`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
