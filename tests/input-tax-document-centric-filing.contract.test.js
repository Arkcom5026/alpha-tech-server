'use strict';

const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('TaxDocument-centric input tax filing authority', () => {
  test('migration preserves legacy receipt compatibility while adding TaxDocument authority', () => {
    const migration = read('prisma/migrations/20260729103000_add_tax_document_centric_input_tax_filing/migration.sql');
    expect(migration).toContain('"taxDocumentId" INTEGER');
    expect(migration).toContain('ALTER COLUMN "purchaseOrderReceiptId" DROP NOT NULL');
    expect(migration).toContain('"eligibilitySnapshot" JSONB');
    expect(migration).toContain('"documentSnapshot" JSONB');
    expect(migration).toContain('InputTaxFilingItem_batchId_taxDocumentId_key');
    expect(migration).toContain('InputTaxFilingItem_authority_check');
  });

  test('selection service requires reconciliation and eligibility before durable selection', () => {
    const service = read('src/modules/tax/inputDocuments/filing/inputTaxFilingService.js');
    expect(service).toContain('INPUT_TAX_FILING_RECONCILIATION_REQUIRED');
    expect(service).toContain('INPUT_TAX_FILING_ELIGIBILITY_REQUIRED');
    expect(service).toContain('INPUT_TAX_DOCUMENT_ALREADY_IN_FILING');
    expect(service).toContain('eligibilitySnapshot');
    expect(service).toContain('documentSnapshot');
  });

  test('overview prefers durable selected and filed timestamps with snapshot fallback', () => {
    const repository = read('src/modules/tax/inputDocuments/overview/inputTaxOverviewRepository.js');
    expect(repository).toContain('filing_summary."selectedAt"');
    expect(repository).toContain('filing_summary."filedAt"');
    expect(repository).toContain('inputTaxSelectedAt');
    expect(repository).toContain('inputTaxSubmittedAt');
  });
});
