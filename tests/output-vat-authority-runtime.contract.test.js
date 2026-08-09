'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  createOutputVatRecordService,
  replayKeyFor,
} = require('../src/modules/tax/outputVat/outputVatRecordService');
const reportRepository = require('../src/modules/reporting/sales/runtime/salesReportRuntimeRepository');
const reportService = require('../src/modules/reporting/sales/runtime/salesReportRuntimeService');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const issuedDocument = (overrides = {}) => ({
  id: 101,
  branchId: 2,
  documentType: 'OUTPUT_TAX_INVOICE',
  documentNumber: 'TD-101',
  status: 'REGISTERED',
  issuedAt: new Date('2026-08-09T03:00:00.000Z'),
  issuerProfileId: 7,
  issuedDocumentNumber: 'TAX-000101',
  taxInvoiceKind: 'SHORT',
  currency: 'THB',
  subtotalAmount: '100.00',
  taxAmount: '7.00',
  totalAmount: '107.00',
  issuerSnapshot: { legalName: 'Alpha Tech' },
  recipientSnapshot: { legalName: 'Customer', taxId: '1234567890123', branchCode: '00000' },
  snapshot: { source: 'TAX_DOCUMENT' },
  ...overrides,
});

const createTx = ({ existing = null, period = { id: 'period-2026-08', branchId: 2 }, createError = null } = {}) => {
  const calls = { periods: [], creates: [] };
  return {
    calls,
    taxPeriod: {
      findFirst: async (args) => { calls.periods.push(args); return period; },
    },
    outputVatRecord: {
      findUnique: async () => existing,
      create: async ({ data }) => {
        calls.creates.push(data);
        if (createError) throw createError;
        return { id: 'vat-1', ...data };
      },
    },
  };
};

(async () => {
  const service = createOutputVatRecordService();

  for (const kind of ['SHORT', 'FULL']) {
    const tx = createTx();
    const document = issuedDocument({ taxInvoiceKind: kind });
    const result = await service.recordIssuedDocument({ tx, branchId: 2, document, ledgerType: 'OUTPUT_VAT' });
    assert.equal(result.replayed, false);
    assert.equal(tx.calls.creates.length, 1);
    assert.equal(tx.calls.creates[0].taxDocumentId, 101);
    assert.equal(tx.calls.creates[0].taxPeriodId, 'period-2026-08');
    assert.equal(tx.calls.creates[0].taxInvoiceKind, kind);
    assert.equal(tx.calls.creates[0].subtotalAmount, '100.00');
    assert.equal(tx.calls.creates[0].taxAmount, '7.00');
    assert.equal(tx.calls.creates[0].totalAmount, '107.00');
    assert.equal(tx.calls.creates[0].replayKey, replayKeyFor(document));
  }

  const existing = { id: 'vat-existing', branchId: 2, taxDocumentId: 101, ledgerType: 'OUTPUT_VAT' };
  const replayTx = createTx({ existing });
  const replay = await service.recordIssuedDocument({ tx: replayTx, branchId: 2, document: issuedDocument() });
  assert.equal(replay.replayed, true);
  assert.equal(replay.record, existing);
  assert.equal(replayTx.calls.creates.length, 0);

  const creditTx = createTx();
  const credit = issuedDocument({
    id: 102,
    documentType: 'OUTPUT_TAX_CREDIT_NOTE',
    issuedDocumentNumber: 'CN-000001',
    originalTaxDocumentId: 101,
    issuerSnapshot: { legalName: 'Alpha Tech', originalIssuedDocumentNumber: 'TAX-000101' },
  });
  await service.recordIssuedDocument({ tx: creditTx, branchId: 2, document: credit, ledgerType: 'OUTPUT_VAT_ADJUSTMENT' });
  assert.equal(creditTx.calls.creates[0].ledgerType, 'OUTPUT_VAT_ADJUSTMENT');
  assert.equal(creditTx.calls.creates[0].originalTaxDocumentId, 101);
  assert.equal(creditTx.calls.creates[0].originalDocumentNumber, 'TAX-000101');

  await assert.rejects(
    service.recordIssuedDocument({ tx: createTx(), branchId: 3, document: issuedDocument() }),
    { code: 'OUTPUT_VAT_DOCUMENT_BRANCH_MISMATCH' },
  );
  const persistenceFailure = Object.assign(new Error('VAT persistence failed'), { code: 'VAT_WRITE_FAILED' });
  await assert.rejects(
    service.recordIssuedDocument({ tx: createTx({ createError: persistenceFailure }), branchId: 2, document: issuedDocument() }),
    { code: 'VAT_WRITE_FAILED' },
  );

  const originalFindMany = reportRepository.prisma.outputVatRecord.findMany;
  let reportQuery;
  reportRepository.prisma.outputVatRecord.findMany = async (args) => {
    reportQuery = args;
    return [
      { id: 'vat-sale', taxDocumentId: 101, taxPeriodId: 'period-2026-08', documentDate: new Date(), issuedDocumentNumber: 'TAX-1', taxInvoiceKind: 'SHORT', ledgerType: 'OUTPUT_VAT', subtotalAmount: 100, taxAmount: 7, totalAmount: 107, counterpartyName: 'A', counterpartyTaxId: '', documentSnapshot: {}, recipientSnapshot: {}, originalTaxDocumentId: null, taxDocument: { status: 'REGISTERED' } },
      { id: 'vat-return', taxDocumentId: 102, taxPeriodId: 'period-2026-08', documentDate: new Date(), issuedDocumentNumber: 'CN-1', taxInvoiceKind: null, ledgerType: 'OUTPUT_VAT_ADJUSTMENT', subtotalAmount: 100, taxAmount: 7, totalAmount: 107, counterpartyName: 'A', counterpartyTaxId: '', documentSnapshot: {}, recipientSnapshot: {}, originalTaxDocumentId: 101, taxDocument: { status: 'REGISTERED' } },
    ];
  };
  try {
    const report = await reportService.getSalesTaxReport({ branchId: 2, startDate: '2026-08-01', endDate: '2026-08-31' });
    assert.equal(report.authority, 'OUTPUT_VAT_RECORD');
    assert.equal(report.sales.length, 1);
    assert.equal(report.returns.length, 1);
    assert.equal(report.sales[0].vatAmount, 7);
    assert.equal(report.returns[0].vatAmount, -7);
    assert.equal(reportQuery.where.branchId, 2);
    assert.ok(reportQuery.where.documentDate);
  } finally {
    reportRepository.prisma.outputVatRecord.findMany = originalFindMany;
  }

  const invoiceIssue = read('src/modules/tax/documents/issue/issueOutputTaxDocumentService.js');
  const creditIssue = read('src/modules/tax/documents/creditNote/create/issueOutputTaxCreditNoteService.js');
  const filing = read('src/modules/tax/outputDocuments/filing/salesTaxFilingService.js');
  const period = read('src/modules/tax/periods/taxPeriodService.js');
  const outputVat = read('src/modules/tax/outputVat/outputVatRecordService.js');
  assert.match(invoiceIssue, /outputVatRecordService\.recordIssuedDocument/);
  assert.match(creditIssue, /OUTPUT_VAT_ADJUSTMENT/);
  assert.match(filing, /FROM "OutputVatRecord" record/);
  assert.match(period, /FROM "OutputVatRecord" record/);
  assert.doesNotMatch(outputVat, /stock|inventory|payment/i);

  console.log('Output VAT authority runtime contract: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
