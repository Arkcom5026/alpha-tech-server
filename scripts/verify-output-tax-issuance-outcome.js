'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority');

const taxDocumentId = Number(process.argv[2]);
const expectedKind = String(process.argv[3] || '').trim().toUpperCase();

if (!Number.isInteger(taxDocumentId) || taxDocumentId <= 0) {
  require('../tests/output-tax-issuance-outcome.contract.test');
  console.log('Output tax issuance runtime outcome: SKIP (tax document id not supplied; contract verified).');
  return;
}
if (expectedKind && !['SHORT', 'FULL'].includes(expectedKind)) {
  throw new Error('Expected tax invoice kind must be SHORT or FULL when supplied.');
}

const restorePath = path.join(process.cwd(), '.env.restore');
if (!fs.existsSync(restorePath)) throw new Error('Missing .env.restore.');

dotenv.config({ path: restorePath, override: true });
const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
const authorityEnv = { ...process.env };
delete authorityEnv.DATABASE_URL;
delete authorityEnv.DIRECT_URL;
const authority = assertTestDatabaseAuthority({ targetUrl, env: authorityEnv });

const fail = (message, details = {}) => {
  console.log(JSON.stringify({
    result: 'FAIL',
    databaseModified: false,
    authority: {
      host: authority.target.host,
      port: authority.target.port,
      database: authority.target.database,
      projectRef: authority.target.projectRef,
    },
    taxDocumentId,
    expectedKind: expectedKind || null,
    message,
    details,
  }, null, 2));
  process.exitCode = 2;
};

const requireText = (value, field) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${field}`);
  return value.trim();
};

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

    const documentResult = await client.query(`
      SELECT
        d."id", d."branchId", d."status", d."documentType",
        d."taxInvoiceKind", d."issuerProfileId", d."issuedDocumentNumber",
        d."issuedSequence", d."issuerSnapshot", d."recipientSnapshot",
        c."sourceType", c."sourceId"
      FROM "TaxDocument" d
      LEFT JOIN "TaxCandidate" c ON c."id" = d."candidateId"
      WHERE d."id" = $1
      LIMIT 1
    `, [taxDocumentId]);
    const document = documentResult.rows[0];
    if (!document) return fail('Tax document was not found.');

    const eventResult = await client.query(`
      SELECT "fromStatus", "toStatus", "metadata"
      FROM "TaxDocumentLifecycleEvent"
      WHERE "taxDocumentId" = $1
      ORDER BY "occurredAt" ASC, "id" ASC
    `, [taxDocumentId]);

    const saleId = Number(document.sourceId);
    const saleResult = Number.isInteger(saleId) && saleId > 0
      ? await client.query(`
          SELECT "id", "branchId", "status", "paid", "statusPayment"
          FROM "Sale"
          WHERE "id" = $1
          LIMIT 1
        `, [saleId])
      : { rows: [] };
    await client.query('COMMIT');

    if (document.documentType !== 'OUTPUT_TAX_INVOICE' || document.sourceType !== 'SALE') {
      return fail('Document is not an output-tax document sourced from a sale.', {
        documentType: document.documentType,
        sourceType: document.sourceType,
      });
    }
    if (document.status !== 'REGISTERED') {
      return fail('Tax document is not registered.', { status: document.status });
    }
    if (!document.taxInvoiceKind || (expectedKind && document.taxInvoiceKind !== expectedKind)) {
      return fail('Tax invoice kind does not match the expected issuance.', {
        actualKind: document.taxInvoiceKind,
      });
    }
    if (!Number.isInteger(Number(document.issuerProfileId)) || Number(document.issuerProfileId) <= 0) {
      return fail('Issued document has no issuer profile evidence.');
    }
    if (!Number.isInteger(Number(document.issuedSequence)) || Number(document.issuedSequence) <= 0) {
      return fail('Issued document sequence is invalid.', { issuedSequence: document.issuedSequence });
    }
    try {
      requireText(document.issuedDocumentNumber, 'issuedDocumentNumber');
      const issuer = document.issuerSnapshot || {};
      requireText(issuer.legalName, 'issuerSnapshot.legalName');
      if (!/^\\d{13}$/.test(String(issuer.taxId || '').replace(/\\D/g, ''))) throw new Error('Invalid issuerSnapshot.taxId');
      requireText(issuer.registeredAddress, 'issuerSnapshot.registeredAddress');
      if (!/^\\d{5}$/.test(String(issuer.branchCode || ''))) throw new Error('Invalid issuerSnapshot.branchCode');
      requireText(issuer.prefix, 'issuerSnapshot.prefix');
    } catch (error) {
      return fail('Issuer snapshot is incomplete.', { reason: error.message });
    }

    if (document.taxInvoiceKind === 'FULL') {
      try {
        const recipient = document.recipientSnapshot || {};
        requireText(recipient.legalName, 'recipientSnapshot.legalName');
        if (!/^\\d{13}$/.test(String(recipient.taxId || '').replace(/\\D/g, ''))) throw new Error('Invalid recipientSnapshot.taxId');
        requireText(recipient.registeredAddress, 'recipientSnapshot.registeredAddress');
        if (!/^\\d{5}$/.test(String(recipient.branchCode || ''))) throw new Error('Invalid recipientSnapshot.branchCode');
      } catch (error) {
        return fail('Full tax invoice recipient snapshot is incomplete.', { reason: error.message });
      }
    } else if (document.recipientSnapshot != null) {
      return fail('Short tax invoice must not retain a recipient snapshot.');
    }

    const sale = saleResult.rows[0];
    if (!sale || Number(sale.branchId) !== Number(document.branchId)) {
      return fail('No same-branch sale evidence was found.', {
        saleId: document.sourceId,
        documentBranchId: document.branchId,
        saleBranchId: sale?.branchId || null,
      });
    }
    if (sale.paid !== true || sale.statusPayment !== 'PAID') {
      return fail('Source sale is not fully paid.', {
        saleId: sale.id,
        paid: sale.paid,
        statusPayment: sale.statusPayment,
      });
    }
    const issuedEvent = eventResult.rows.find((event) => (
      event.fromStatus === 'DRAFT' && event.toStatus === 'REGISTERED'
    ));
    if (!issuedEvent) return fail('No DRAFT-to-REGISTERED lifecycle evidence was found.');

    console.log(JSON.stringify({
      result: 'PASS',
      databaseModified: false,
      authority: {
        host: authority.target.host,
        port: authority.target.port,
        database: authority.target.database,
        projectRef: authority.target.projectRef,
      },
      document: {
        id: Number(document.id),
        branchId: Number(document.branchId),
        status: document.status,
        taxInvoiceKind: document.taxInvoiceKind,
        issuerProfileId: Number(document.issuerProfileId),
        issuedDocumentNumber: document.issuedDocumentNumber,
        issuedSequence: Number(document.issuedSequence),
      },
      sale: {
        id: Number(sale.id),
        branchId: Number(sale.branchId),
        status: sale.status,
        paid: sale.paid,
        statusPayment: sale.statusPayment,
      },
      lifecycle: {
        fromStatus: issuedEvent.fromStatus,
        toStatus: issuedEvent.toStatus,
      },
    }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`OUTPUT_TAX_ISSUANCE_OUTCOME_VERIFICATION_FAILED: ${error.message || error}`);
  process.exitCode = 1;
});
