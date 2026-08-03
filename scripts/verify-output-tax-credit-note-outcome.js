'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority');

const creditNoteId = Number(process.argv[2]);

if (!Number.isInteger(creditNoteId) || creditNoteId <= 0) {
  require('../tests/output-tax-credit-note-outcome.contract.test');
  console.log('Output tax credit-note outcome: SKIP (credit-note id not supplied; contract verified).');
  return;
}

const restorePath = path.join(process.cwd(), '.env.restore');
if (!fs.existsSync(restorePath)) throw new Error('Missing .env.restore.');

dotenv.config({ path: restorePath, override: true });
const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
const authorityEnv = { ...process.env };
delete authorityEnv.DATABASE_URL;
delete authorityEnv.DIRECT_URL;
const authority = assertTestDatabaseAuthority({ targetUrl, env: authorityEnv });

const evidence = () => ({
  host: authority.target.host,
  port: authority.target.port,
  database: authority.target.database,
  projectRef: authority.target.projectRef,
});

const fail = (message, details = {}) => {
  console.log(JSON.stringify({
    result: 'FAIL',
    databaseModified: false,
    authority: evidence(),
    creditNoteId,
    message,
    details,
  }, null, 2));
  process.exitCode = 2;
};

const asNumber = (value) => Number(value || 0);
const sameMoney = (left, right) => Math.abs(asNumber(left) - asNumber(right)) < 0.0001;

async function main() {
  const url = new URL(targetUrl);
  url.searchParams.delete('sslmode');
  const client = new Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    await client.query('BEGIN READ ONLY');

    const result = await client.query(
      `SELECT
        cn."id" AS "creditNoteId",
        cn."branchId" AS "creditNoteBranchId",
        cn."documentType" AS "creditNoteType",
        cn."status" AS "creditNoteStatus",
        cn."issuerProfileId",
        cn."issuedDocumentNumber" AS "creditNoteNumber",
        cn."issuedSequence" AS "creditNoteSequence",
        cn."issuerSnapshot" AS "creditNoteIssuerSnapshot",
        cn."originalTaxDocumentId",
        cn."saleReturnId",
        cn."subtotalAmount" AS "creditNoteSubtotal",
        cn."taxAmount" AS "creditNoteTax",
        cn."totalAmount" AS "creditNoteTotal",
        original."id" AS "originalId",
        original."branchId" AS "originalBranchId",
        original."documentType" AS "originalType",
        original."status" AS "originalStatus",
        original."issuedDocumentNumber" AS "originalNumber",
        original."issuedSequence" AS "originalSequence",
        original."totalAmount" AS "originalTotal",
        returned."id" AS "saleReturnIdEvidence",
        returned."branchId" AS "saleReturnBranchId",
        returned."saleId",
        returned."status" AS "saleReturnStatus",
        returned."isFullyRefunded",
        returned."refundedAmount",
        returned."deductedAmount",
        returned."totalRefund",
        refund."amount" AS "refundAmount",
        refund."deducted" AS "refundDeducted",
        refund."branchId" AS "refundBranchId"
      FROM "TaxDocument" cn
      LEFT JOIN "TaxDocument" original ON original."id" = cn."originalTaxDocumentId"
      LEFT JOIN "SaleReturn" returned ON returned."id" = cn."saleReturnId"
      LEFT JOIN "RefundTransaction" refund ON refund."saleReturnId" = returned."id"
      WHERE cn."id" = $1
      ORDER BY refund."id" ASC
      LIMIT 1`,
      [creditNoteId],
    );

    const row = result.rows[0];
    const eventResult = await client.query(
      `SELECT "fromStatus", "toStatus", "metadata"
       FROM "TaxDocumentLifecycleEvent"
       WHERE "taxDocumentId" = $1
       ORDER BY "occurredAt" ASC, "id" ASC`,
      [creditNoteId],
    );
    await client.query('COMMIT');

    if (!row) return fail('Credit note was not found.');
    if (row.creditNoteType !== 'OUTPUT_TAX_CREDIT_NOTE' || row.creditNoteStatus !== 'REGISTERED') {
      return fail('Credit note is not a registered output-tax credit note.', {
        documentType: row.creditNoteType,
        status: row.creditNoteStatus,
      });
    }
    if (!row.originalTaxDocumentId || row.originalType !== 'OUTPUT_TAX_INVOICE' || row.originalStatus !== 'REGISTERED') {
      return fail('Original registered output-tax invoice evidence is missing.', {
        originalTaxDocumentId: row.originalTaxDocumentId,
        originalType: row.originalType,
        originalStatus: row.originalStatus,
      });
    }
    if (!row.saleReturnId || row.saleReturnStatus !== 'COMPLETED' || row.isFullyRefunded !== true) {
      return fail('Completed full-return evidence is missing.', {
        saleReturnId: row.saleReturnId,
        saleReturnStatus: row.saleReturnStatus,
        isFullyRefunded: row.isFullyRefunded,
      });
    }

    const branches = [row.creditNoteBranchId, row.originalBranchId, row.saleReturnBranchId, row.refundBranchId];
    if (branches.some((branchId) => Number(branchId) !== Number(row.creditNoteBranchId))) {
      return fail('Cross-branch tax-credit-note evidence was found.', {
        creditNoteBranchId: row.creditNoteBranchId,
        originalBranchId: row.originalBranchId,
        saleReturnBranchId: row.saleReturnBranchId,
        refundBranchId: row.refundBranchId,
      });
    }
    if (!sameMoney(row.refundedAmount, row.originalTotal)
      || !sameMoney(row.totalRefund, row.originalTotal)
      || !sameMoney(row.refundAmount, row.originalTotal)
      || !sameMoney(row.deductedAmount, 0)
      || !sameMoney(row.refundDeducted, 0)) {
      return fail('Return is not a full, zero-deduction refund of the original invoice.', {
        originalTotal: row.originalTotal,
        refundedAmount: row.refundedAmount,
        totalRefund: row.totalRefund,
        refundAmount: row.refundAmount,
        deductedAmount: row.deductedAmount,
        refundDeducted: row.refundDeducted,
      });
    }
    if (!row.issuerProfileId || !row.creditNoteNumber || Number(row.creditNoteSequence) <= 0
      || !row.originalNumber || Number(row.originalSequence) <= 0) {
      return fail('Issued document identity evidence is incomplete.', {
        issuerProfileId: row.issuerProfileId,
        creditNoteNumber: row.creditNoteNumber,
        creditNoteSequence: row.creditNoteSequence,
        originalNumber: row.originalNumber,
        originalSequence: row.originalSequence,
      });
    }

    const issuer = row.creditNoteIssuerSnapshot || {};
    if (issuer.originalIssuedDocumentNumber !== row.originalNumber) {
      return fail('Credit-note issuer snapshot does not preserve the original invoice reference.', {
        snapshotOriginalNumber: issuer.originalIssuedDocumentNumber || null,
        originalNumber: row.originalNumber,
      });
    }

    const registered = eventResult.rows.some((event) => event.toStatus === 'REGISTERED');
    if (!registered) return fail('Credit note has no REGISTERED lifecycle event.');

    console.log(JSON.stringify({
      result: 'PASS',
      databaseModified: false,
      authority: evidence(),
      creditNote: {
        id: Number(row.creditNoteId),
        branchId: Number(row.creditNoteBranchId),
        status: row.creditNoteStatus,
        issuedDocumentNumber: row.creditNoteNumber,
        issuedSequence: Number(row.creditNoteSequence),
        issuerProfileId: Number(row.issuerProfileId),
        originalTaxDocumentId: Number(row.originalTaxDocumentId),
        saleReturnId: Number(row.saleReturnId),
      },
      originalInvoice: {
        id: Number(row.originalId),
        branchId: Number(row.originalBranchId),
        status: row.originalStatus,
        issuedDocumentNumber: row.originalNumber,
        issuedSequence: Number(row.originalSequence),
        totalAmount: asNumber(row.originalTotal),
      },
      saleReturn: {
        id: Number(row.saleReturnIdEvidence),
        saleId: Number(row.saleId),
        branchId: Number(row.saleReturnBranchId),
        status: row.saleReturnStatus,
        refundedAmount: asNumber(row.refundedAmount),
        deductedAmount: asNumber(row.deductedAmount),
      },
    }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`OUTPUT_TAX_CREDIT_NOTE_OUTCOME_VERIFICATION_FAILED: ${error.message || error}`);
  process.exitCode = 1;
});
