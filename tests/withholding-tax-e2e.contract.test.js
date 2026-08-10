'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

test('WHT Prisma foundation separates treatment certificate record and filing authorities', () => {
  const schema = read('prisma/tax/withholding-tax.prisma');
  const coreMigration = read('prisma/migrations/20260810123000_withholding_tax_workflow/migration.sql');
  const treatmentMigration = read('prisma/migrations/20260810124500_withholding_tax_treatment_audit/migration.sql');

  assert.match(schema, /model WithholdingTaxTreatmentEvent/);
  assert.match(schema, /model WithholdingTaxCertificate/);
  assert.match(schema, /taxExpenseId\s+Int\s+@unique/);
  assert.match(schema, /model WithholdingTaxRecord/);
  assert.match(schema, /taxExpenseItemId\s+Int\s+@unique/);
  assert.match(schema, /model WithholdingTaxFilingBatch/);
  assert.match(schema, /model WithholdingTaxFilingItem/);
  assert.match(schema, /PND3/);
  assert.match(schema, /PND53/);

  assert.doesNotMatch(coreMigration, /CREATE TABLE "WithholdingTaxTreatmentEvent"/);
  assert.match(coreMigration, /CREATE TABLE "WithholdingTaxCertificate"/);
  assert.match(coreMigration, /CREATE TABLE "WithholdingTaxRecord"/);
  assert.match(coreMigration, /CREATE TABLE "WithholdingTaxFilingBatch"/);
  assert.match(coreMigration, /CREATE TABLE "WithholdingTaxFilingItem"/);
  assert.doesNotMatch(coreMigration, /CREATE UNIQUE INDEX "TaxExpenseItem_id_branchId_key"/);
  assert.match(coreMigration, /FOREIGN KEY \("taxExpenseItemId"\) REFERENCES "TaxExpenseItem"\("id"\)/);
  assert.match(treatmentMigration, /CREATE TABLE "WithholdingTaxTreatmentEvent"/);
  assert.match(treatmentMigration, /FOREIGN KEY \("taxExpenseItemId"\) REFERENCES "TaxExpenseItem"\("id"\)/);
  assert.doesNotMatch(coreMigration, /UPDATE "TaxExpense"/);
  assert.doesNotMatch(treatmentMigration, /UPDATE "TaxExpenseItem"/);
  assert.doesNotMatch(coreMigration, /INSERT INTO "WithholdingTaxRecord"/);
});

test('WHT human confirmation persists append-only treatment event evidence', () => {
  const source = read('src/modules/tax/withholdingTax/withholdingTaxTreatmentService.js');
  assert.match(source, /PENDING_REVIEW: Object\.freeze\(\['WITHHOLDING_REQUIRED'\]\)/);
  assert.match(source, /WITHHOLDING_REQUIRED: Object\.freeze\(\['WITHHELD'\]\)/);
  assert.match(source, /INSERT INTO "WithholdingTaxTreatmentEvent"/);
  assert.match(source, /submittedPeriodLocked/);
  assert.match(source, /WHT_PERIOD_IMMUTABLE/);
  assert.match(source, /WHT_TREATMENT_CONCURRENT_MODIFICATION/);
  assert.match(source, /WHT_TREATMENT_CERTIFICATE_LOCKED/);
});

test('WHT form authority defaults individual to PND3 and legal entity to PND53', () => {
  const source = read('src/modules/tax/withholdingTax/withholdingTaxService.js');
  assert.match(source, /payeeType === 'INDIVIDUAL'.*'PND3'/);
  assert.match(source, /payeeType === 'LEGAL_ENTITY'.*'PND53'/);
  assert.match(source, /WHT_FORM_REVIEW_REQUIRED/);
  assert.match(source, /WHT_FORM_TYPE_MISMATCH/);
});

test('certificate issuance requires WITHHELD item authority and active issuer profile', () => {
  const source = read('src/modules/tax/withholdingTax/withholdingTaxService.js');
  assert.match(source, /issuer\."status" = 'ACTIVE'::"TaxIssuerProfileStatus"/);
  assert.match(source, /WHT_ISSUER_PROFILE_REQUIRED/);
  assert.match(source, /item\.whtTreatment !== 'WITHHELD'/);
  assert.match(source, /WHT_ITEMS_NOT_WITHHELD/);
  assert.match(source, /WithholdingTaxCertificate/);
  assert.match(source, /ON CONFLICT \("taxExpenseId"\)/);
  assert.match(source, /WithholdingTaxCertificate"\."version" \+ 1/);
  assert.match(source, /ON CONFLICT \("taxExpenseItemId"\)/);
  assert.match(source, /'CERTIFIED'::"WithholdingTaxRecordStatus"/);
});

test('submitted WHT filing makes certificate source immutable', () => {
  const source = read('src/modules/tax/withholdingTax/withholdingTaxService.js');
  assert.match(source, /WHT_CERTIFICATE_ALREADY_FILED/);
  assert.match(source, /batch\."status" = 'SUBMITTED'::"WithholdingTaxFilingStatus"/);
  assert.match(source, /WHT_PERIOD_IMMUTABLE/);
});

test('WHT filing preparation snapshots certified records by PND form', () => {
  const source = read('src/modules/tax/withholdingTax/withholdingTaxService.js');
  assert.match(source, /prepareWithholdingFiling/);
  assert.match(source, /'PREPARED'::"WithholdingTaxFilingStatus"/);
  assert.match(source, /'CERTIFIED'::"WithholdingTaxRecordStatus"/);
  assert.match(source, /certificate\."status" = 'ISSUED'::"WithholdingTaxCertificateStatus"/);
  assert.match(source, /sourceSnapshot/);
  assert.match(source, /taxableBaseAmount/);
  assert.match(source, /withholdingTaxAmount/);
});

test('WHT controller blocks filing preparation after tax-period submit', () => {
  const controller = read('src/modules/tax/withholdingTax/withholdingTaxController.js');
  assert.match(controller, /requireMutablePeriod/);
  assert.match(controller, /workspace\?\.period\?\.status/);
  assert.match(controller, /WHT_PERIOD_IMMUTABLE/);
  assert.match(controller, /await requireMutablePeriod/);
});

test('WHT submission is manual evidence authority and not direct government filing', () => {
  const source = read('src/modules/tax/withholdingTax/withholdingTaxService.js');
  const controller = read('src/modules/tax/withholdingTax/withholdingTaxController.js');
  assert.match(source, /WHT_SUBMISSION_EVIDENCE_REQUIRED/);
  assert.match(source, /submissionEvidence/);
  assert.match(source, /'SUBMITTED'::"WithholdingTaxFilingStatus"/);
  assert.match(source, /'FILED'::"WithholdingTaxRecordStatus"/);
  assert.match(controller, /evidence: req\.body\?\.evidence/);
  assert.doesNotMatch(source, /rd\.go\.th|e-Filing|efiling/i);
});

test('WHT readiness is normalized from blocking exception authority at response boundaries', () => {
  const readiness = read('src/modules/tax/withholdingTax/withholdingTaxReadiness.js');
  const controller = read('src/modules/tax/withholdingTax/withholdingTaxController.js');
  const accountingController = read('src/modules/tax/accountingOffice/accountingOfficePackageController.js');
  assert.match(readiness, /WHT_PND3_FILING_/);
  assert.match(readiness, /WHT_PND53_FILING_/);
  assert.match(readiness, /submittedFilingCount/);
  assert.match(readiness, /readyForAccountant: certificatesReady && filingsReady/);
  assert.match(controller, /normalizeWithholdingTaxWorkspace/);
  assert.match(accountingController, /normalizeWithholdingTaxWorkspace/);
});

test('accountant package consumes WHT certificate and filing authority instead of legacy attachment blockers', () => {
  const controller = read('src/modules/tax/accountingOffice/accountingOfficePackageController.js');
  assert.match(controller, /withholdingTaxService\.loadWithholdingTaxWorkspace/);
  assert.match(controller, /WITHHOLDING_TAX_RECORD_CERTIFICATE_AND_FILING/);
  assert.match(controller, /withholdingFilingsSubmitted/);
  assert.match(controller, /withholdingSummary/);
  assert.match(controller, /withholdingFilings/);
  assert.match(controller, /LEGACY_WHT_EXCEPTION_CODES/);
  assert.match(controller, /WITHHOLDING_CERTIFICATE_MISSING/);
  assert.match(controller, /WITHHOLDING_NOT_COMPLETED/);
});

test('WHT migration verifier checks complete chain all authority tables and zero backfill', () => {
  const verifier = read('scripts/verify-withholding-tax-migration.js');
  assert.match(verifier, /20260810123000_withholding_tax_workflow/);
  assert.match(verifier, /20260810124500_withholding_tax_treatment_audit/);
  assert.match(verifier, /WithholdingTaxTreatmentEvent/);
  assert.match(verifier, /WithholdingTaxCertificate/);
  assert.match(verifier, /WithholdingTaxRecord/);
  assert.match(verifier, /WithholdingTaxFilingBatch/);
  assert.match(verifier, /WithholdingTaxFilingItem/);
  assert.match(verifier, /to_regclass/);
  assert.match(verifier, /rowCount !== 0/);
  assert.match(verifier, /must not backfill authority rows/);
});

test('tax router exposes WHT workspace treatment certificate and filing endpoints', () => {
  const routes = read('src/modules/tax/periods/taxPeriodRoutes.js');
  assert.match(routes, /withholding-tax\/\:taxPeriodId/);
  assert.match(routes, /items\/\:taxExpenseItemId\/treatment/);
  assert.match(routes, /certificates\/issue/);
  assert.match(routes, /filings\/\:formType\/prepare/);
  assert.match(routes, /filings\/\:formType\/submit/);
  assert.match(routes, /withholdingTaxController/);
});
