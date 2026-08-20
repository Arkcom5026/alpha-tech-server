'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority');

const fail = (message) => {
  const error = new Error(message);
  error.code = 'DOCUMENT_REPLACEMENT_RUNTIME_VERIFICATION_FAILED';
  throw error;
};

const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};
const positiveInt = (value, name) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) fail(`${name} must be a positive integer`);
  return parsed;
};
const amount = (value) => Number(Number(value || 0).toFixed(2));

const saleId = positiveInt(argValue('--sale'), '--sale');
const branchIdArg = argValue('--branch');
const expectedBranchId = branchIdArg == null ? null : positiveInt(branchIdArg, '--branch');

const restorePath = path.join(process.cwd(), '.env.restore');
if (!fs.existsSync(restorePath)) throw new Error('Missing .env.restore. Runtime certification is test-database only.');
dotenv.config({ path: restorePath, override: true });
const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
const authorityEnv = { ...process.env };
delete authorityEnv.DATABASE_URL;
delete authorityEnv.DIRECT_URL;
const authority = assertTestDatabaseAuthority({ targetUrl, env: authorityEnv });

async function main() {
  const url = new URL(targetUrl);
  url.searchParams.delete('sslmode');
  const client = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');

    const saleResult = await client.query(`
      SELECT "id", "branchId", "code", "totalAmount", "vat"
      FROM "Sale" WHERE "id" = $1 LIMIT 1
    `, [saleId]);
    const sale = saleResult.rows[0];
    if (!sale) fail('Sale not found');
    if (expectedBranchId && Number(sale.branchId) !== expectedBranchId) fail('Sale branch does not match --branch');

    const prepResult = await client.query(`
      SELECT * FROM "SaleDocumentPreparation"
      WHERE "branchId" = $1 AND "sourceType" = 'SALE' AND "sourceId" = $2
      LIMIT 1
    `, [sale.branchId, String(sale.id)]);
    const preparation = prepResult.rows[0];
    if (!preparation || preparation.status !== 'LOCKED' || !preparation.finalSnapshot) {
      fail('Locked document preparation not found');
    }

    const replacementResult = await client.query(`
      SELECT * FROM "SaleDocumentReplacement"
      WHERE "branchId" = $1 AND "preparationId" = $2
      ORDER BY "replacementNumber" ASC
    `, [sale.branchId, preparation.id]);
    const replacements = replacementResult.rows;
    if (!replacements.length) fail('No document replacement found');

    const current = replacements.filter((item) => item.currentKey && item.status === 'LOCKED');
    if (current.length !== 1) fail(`Expected exactly one current LOCKED replacement, found ${current.length}`);
    const currentReplacement = current[0];
    if (!currentReplacement.finalSnapshot) fail('Current replacement has no immutable finalSnapshot');

    replacements.forEach((replacement, index) => {
      if (Number(replacement.replacementNumber) !== index + 1) fail(`Replacement numbering gap at id ${replacement.id}`);
      if (replacement.id !== currentReplacement.id && replacement.status === 'LOCKED') fail(`Non-current replacement ${replacement.id} must not remain LOCKED`);
      if (replacement.status === 'SUPERSEDED' && !replacement.supersededAt) fail(`SUPERSEDED replacement ${replacement.id} is missing supersededAt`);
    });

    const taxResult = await client.query(`
      SELECT d.*, c."sourceId", v."id" AS "outputVatRecordId", v."taxPeriodId",
             v."subtotalAmount" AS "vatSubtotalAmount", v."taxAmount" AS "vatTaxAmount",
             v."totalAmount" AS "vatTotalAmount", v."taxInvoiceKind" AS "vatTaxInvoiceKind",
             v."issuedDocumentNumber" AS "vatIssuedDocumentNumber"
      FROM "TaxDocument" d
      JOIN "TaxCandidate" c ON c."id" = d."candidateId"
      LEFT JOIN "OutputVatRecord" v ON v."taxDocumentId" = d."id"
      WHERE d."branchId" = $1
        AND c."sourceType" = 'DOCUMENT_PREPARATION'
        AND c."sourceId" LIKE $2
      ORDER BY d."id" ASC
    `, [sale.branchId, `${preparation.id}:%`]);
    const taxDocuments = taxResult.rows;
    if (!taxDocuments.length) fail('No preparation tax documents found');

    const financialLock = currentReplacement.financialLock || {};
    const portions = financialLock.portions || {};
    for (const document of taxDocuments) {
      const portion = String(document.sourceId || '').split(':').pop();
      const lockedPortion = portions[portion];
      if (!lockedPortion) fail(`Financial lock missing ${portion}`);
      if (String(document.taxInvoiceKind || '') !== String(lockedPortion.taxInvoiceKind || '')) fail(`${portion} taxInvoiceKind changed`);
      if (amount(document.subtotalAmount) !== amount(lockedPortion.subtotalAmount)) fail(`${portion} subtotal changed`);
      if (amount(document.taxAmount) !== amount(lockedPortion.taxAmount)) fail(`${portion} VAT changed`);
      if (amount(document.totalAmount) !== amount(lockedPortion.totalAmount)) fail(`${portion} total changed`);
      if (document.outputVatRecordId) {
        if (amount(document.vatSubtotalAmount) !== amount(document.subtotalAmount)) fail(`${portion} Output VAT subtotal drift`);
        if (amount(document.vatTaxAmount) !== amount(document.taxAmount)) fail(`${portion} Output VAT amount drift`);
        if (amount(document.vatTotalAmount) !== amount(document.totalAmount)) fail(`${portion} Output VAT total drift`);
        if (document.vatTaxInvoiceKind !== document.taxInvoiceKind) fail(`${portion} Output VAT kind drift`);
        if (document.vatIssuedDocumentNumber !== document.issuedDocumentNumber) fail(`${portion} issued number drift`);
        if (lockedPortion.taxPeriodId && document.taxPeriodId !== lockedPortion.taxPeriodId) fail(`${portion} tax period drift`);
      }
    }

    const replacementTotals = currentReplacement.finalSnapshot?.totals || {};
    const preparationTotals = preparation.finalSnapshot?.totals || {};
    if (amount(replacementTotals.sourceTotal) !== amount(preparationTotals.sourceTotal)) fail('Replacement source total differs from locked preparation source total');
    if (amount(replacementTotals.sourceTaxAmount) !== amount(preparation.finalSnapshot?.source?.taxAmount)) fail('Replacement source tax differs from locked preparation source tax');

    await client.query('COMMIT');
    console.log(JSON.stringify({
      result: 'PASS', databaseModified: false,
      authority: { host: authority.target.host, port: authority.target.port, database: authority.target.database, projectRef: authority.target.projectRef },
      saleId: Number(sale.id), branchId: Number(sale.branchId), preparationId: Number(preparation.id),
      replacementCount: replacements.length,
      currentReplacement: { id: Number(currentReplacement.id), replacementNumber: Number(currentReplacement.replacementNumber), replacesReplacementId: currentReplacement.replacesReplacementId == null ? null : Number(currentReplacement.replacesReplacementId) },
      taxDocuments: taxDocuments.map((document) => ({ id: Number(document.id), portion: String(document.sourceId || '').split(':').pop(), kind: document.taxInvoiceKind, number: document.issuedDocumentNumber, taxPeriodId: document.taxPeriodId || null })),
    }, null, 2));
    console.log('Document replacement runtime verification: PASS');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.code || 'DOCUMENT_REPLACEMENT_RUNTIME_VERIFICATION_FAILED', error.message || error);
  process.exitCode = 1;
});
