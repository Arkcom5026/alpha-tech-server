'use strict';

const fs = require('fs');
const dotenv = require('dotenv');

const BRANCH_IDS = [2, 5, 14];
const RECOVERY_HOST = 'db.engqdeyzbvnmxbnpemau.supabase.co';
const PURPOSE_CODES = Object.freeze([
  'SALE_RECEIPT',
  'DELIVERY_NOTE',
  'SHORT_TAX_INVOICE',
  'FULL_TAX_INVOICE',
]);

const fail = (message, detail = undefined) => {
  const error = new Error(message);
  error.detail = detail;
  throw error;
};

const readProductionUrl = () => {
  const fileEnv = fs.existsSync('.env')
    ? dotenv.parse(fs.readFileSync('.env'))
    : {};
  const raw = process.env.DIRECT_URL
    || process.env.DATABASE_URL
    || fileEnv.DIRECT_URL
    || fileEnv.DATABASE_URL;

  if (!raw) fail('DATABASE_URL / DIRECT_URL is missing');

  const url = new URL(raw);
  if (url.hostname === RECOVERY_HOST) {
    fail('Recovery/Test database detected; production verification refused', {
      host: url.hostname,
    });
  }

  return { raw, url };
};

const production = readProductionUrl();
process.env.DATABASE_URL = production.raw;
process.env.DIRECT_URL = production.raw;

const { prisma } = require('../src/lib/prisma');
const {
  ResolvePrintDocumentPurposeService,
} = require('../src/modules/document-purpose/resolve/resolvePrintDocumentPurposeService');
const {
  projectSaleDeliveryNote,
} = require('../src/modules/sales/documents/print/projectSaleDeliveryNoteService');
const {
  searchPrintablePayments,
} = require('../src/modules/sales/payment/query/printable/searchPrintablePaymentsController');
const {
  projectOutputTaxPrintableDocument,
} = require('../src/modules/tax/documents/print/projectOutputTaxPrintableDocumentService');

const projectSaleReceiptSearch = async ({ branchId }) => {
  let statusCode = 200;
  let payload;
  const req = {
    user: { branchId },
    query: { limit: '1' },
  };
  const res = {
    status(value) {
      statusCode = value;
      return this;
    },
    json(value) {
      payload = value;
      return value;
    },
  };

  await searchPrintablePayments(req, res);

  if (statusCode !== 200 || !Array.isArray(payload)) {
    fail('SALE_RECEIPT printable search failed', { branchId, statusCode, payload });
  }

  if (payload.length === 0) {
    return {
      status: 'SKIP_NO_PRINTABLE_DATA',
      rowCount: 0,
      samplePaymentId: null,
      documentPurpose: null,
    };
  }

  const purpose = payload[0]?.documentPurpose;
  if (purpose?.code !== 'SALE_RECEIPT' || !purpose?.displayName) {
    fail('SALE_RECEIPT projection does not expose the registry purpose', {
      branchId,
      purpose,
    });
  }

  return {
    status: 'PASS',
    rowCount: payload.length,
    samplePaymentId: payload[0]?.id || null,
    documentPurpose: purpose,
  };
};

const verifyDeliveryNote = async ({ branchId }) => {
  const sale = await prisma.sale.findFirst({
    where: {
      branchId,
      status: 'COMPLETED',
      OR: [
        { isCredit: true },
        { paid: false },
        { statusPayment: { not: 'PAID' } },
      ],
    },
    orderBy: { soldAt: 'desc' },
    select: { id: true, code: true },
  });

  if (!sale) {
    return { status: 'SKIP_NO_ELIGIBLE_DATA' };
  }

  const projection = await projectSaleDeliveryNote({ branchId, saleId: sale.id });
  if (
    projection?.document?.type !== 'DELIVERY_NOTE'
    || !projection?.document?.title
    || Number(projection?.document?.saleId) !== Number(sale.id)
  ) {
    fail('DELIVERY_NOTE projection failed registry compatibility', {
      branchId,
      saleId: sale.id,
      document: projection?.document,
    });
  }

  return {
    status: 'PASS',
    saleId: sale.id,
    saleCode: sale.code,
    document: projection.document,
    lineCount: projection.lines?.length || 0,
  };
};

const verifyTaxKind = async ({ branchId, kind, purposeCode }) => {
  const candidates = await prisma.taxDocument.findMany({
    where: {
      branchId,
      documentType: 'OUTPUT_TAX_INVOICE',
      status: 'REGISTERED',
      taxInvoiceKind: kind,
      issuedDocumentNumber: { not: null },
      candidate: { is: { sourceType: 'SALE' } },
    },
    orderBy: { issuedAt: 'desc' },
    take: 10,
    select: { id: true, issuedDocumentNumber: true },
  });

  for (const candidate of candidates) {
    try {
      const projection = await projectOutputTaxPrintableDocument({
        branchId,
        taxDocumentId: candidate.id,
      });
      if (
        projection?.document?.type !== purposeCode
        || !projection?.document?.title
      ) {
        fail('Output tax projection returned the wrong registry purpose', {
          branchId,
          kind,
          taxDocumentId: candidate.id,
          document: projection?.document,
        });
      }

      return {
        status: 'PASS',
        taxDocumentId: candidate.id,
        documentNumber: candidate.issuedDocumentNumber,
        document: projection.document,
        saleId: projection.sale?.id || null,
        lineCount: projection.lines?.length || 0,
      };
    } catch (error) {
      if (
        error?.code === 'TAX_OUTPUT_PRINT_PAYMENT_REQUIRED'
        || error?.code === 'TAX_SOURCE_SALE_NOT_FOUND'
      ) {
        continue;
      }
      throw error;
    }
  }

  return {
    status: candidates.length > 0
      ? 'SKIP_NO_PRINTABLE_CANDIDATE'
      : 'SKIP_NO_ISSUED_DATA',
    candidateCount: candidates.length,
  };
};

const verifyBranch = async (branchId) => {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, name: true },
  });
  if (!branch) fail('Expected production branch is missing', { branchId });

  const resolver = new ResolvePrintDocumentPurposeService();
  const purposes = {};
  for (const code of PURPOSE_CODES) {
    const purpose = await resolver.execute({ branchId, code });
    purposes[code] = {
      id: purpose.id,
      code: purpose.code,
      displayName: purpose.displayName,
      currentVersion: purpose.currentVersion,
    };
  }

  return {
    branch,
    purposes,
    saleReceipt: await projectSaleReceiptSearch({ branchId }),
    deliveryNote: await verifyDeliveryNote({ branchId }),
    shortTaxInvoice: await verifyTaxKind({
      branchId,
      kind: 'SHORT',
      purposeCode: 'SHORT_TAX_INVOICE',
    }),
    fullTaxInvoice: await verifyTaxKind({
      branchId,
      kind: 'FULL',
      purposeCode: 'FULL_TAX_INVOICE',
    }),
  };
};

async function main() {
  const branches = [];
  for (const branchId of BRANCH_IDS) {
    branches.push(await verifyBranch(branchId));
  }

  const runtimeChecks = branches.flatMap((entry) => [
    entry.saleReceipt.status,
    entry.deliveryNote.status,
    entry.shortTaxInvoice.status,
    entry.fullTaxInvoice.status,
  ]);
  const actualPassCount = runtimeChecks.filter((status) => status === 'PASS').length;
  const skipCount = runtimeChecks.filter((status) => status.startsWith('SKIP_')).length;

  console.log(JSON.stringify({
    result: 'PASS',
    mode: 'READ_ONLY_PRODUCTION_PRINT_RUNTIME',
    databaseModified: false,
    sourceRequirement: 'Run from the deployed/certified main source after production deploy',
    target: {
      host: production.url.hostname,
      port: production.url.port || '5432',
      database: production.url.pathname.replace(/^\//, ''),
    },
    branchIds: BRANCH_IDS,
    purposeCount: BRANCH_IDS.length * PURPOSE_CODES.length,
    runtimeChecks: {
      total: runtimeChecks.length,
      pass: actualPassCount,
      skippedForDataAvailability: skipCount,
    },
    branches,
  }, null, 2));
}

main()
  .catch((error) => {
    console.log(JSON.stringify({
      result: 'FAIL',
      mode: 'READ_ONLY_PRODUCTION_PRINT_RUNTIME',
      databaseModified: false,
      message: error.message || String(error),
      code: error.code || null,
      detail: error.detail,
    }, null, 2));
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
