'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority');

const envPath = path.join(process.cwd(), '.env.restore');
if (!fs.existsSync(envPath)) {
  throw new Error('Missing .env.restore. Wave 7C candidate discovery is Test-DB only.');
}

dotenv.config({ path: envPath, override: true });
const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
const authorityEnv = { ...process.env };
delete authorityEnv.DATABASE_URL;
delete authorityEnv.DIRECT_URL;
const authority = assertTestDatabaseAuthority({ targetUrl, env: authorityEnv });

const toSafeConnectionString = (connectionString) => {
  const url = new URL(connectionString);
  url.searchParams.delete('sslmode');
  return url.toString();
};

async function main() {
  const client = new Client({
    connectionString: toSafeConnectionString(targetUrl),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    await client.query('BEGIN READ ONLY');
    const result = await client.query(`
      SELECT
        s."id" AS "saleId",
        s."branchId",
        s."code" AS "saleCode",
        s."officialDocumentNumber",
        s."status" AS "saleStatus",
        p."id" AS "preparationId",
        p."status" AS "preparationStatus",
        COUNT(DISTINCT d."id")::int AS "taxDocumentCount",
        COUNT(DISTINCT v."id")::int AS "outputVatCount",
        COUNT(DISTINCT r."id")::int AS "replacementCount",
        BOOL_AND(d."status" = 'REGISTERED') AS "allTaxDocumentsRegistered",
        BOOL_AND(d."issuedDocumentNumber" IS NOT NULL) AS "allTaxDocumentsIssued",
        NOT EXISTS (
          SELECT 1
          FROM "ConsolidatedDeliveryLine" cdl
          JOIN "CombinedBilling" cb ON cb."id" = cdl."combinedBillingId"
          WHERE cdl."branchId" = s."branchId"
            AND cdl."sourceSaleId" = s."id"
            AND cdl."status" = 'DOCUMENTED'
            AND cb."status" <> 'CANCELLED'
        ) AS "deliveryNoteActive"
      FROM "SaleDocumentPreparation" p
      JOIN "Sale" s
        ON p."branchId" = s."branchId"
       AND p."sourceType" = 'SALE'
       AND p."sourceId" = s."id"::text
      JOIN "TaxCandidate" tc
        ON tc."branchId" = p."branchId"
       AND tc."sourceType" = 'DOCUMENT_PREPARATION'
       AND tc."sourceId" LIKE p."id"::text || ':%'
      JOIN "TaxDocument" d ON d."candidateId" = tc."id"
      LEFT JOIN "OutputVatRecord" v ON v."taxDocumentId" = d."id"
      LEFT JOIN "SaleDocumentReplacement" r
        ON r."branchId" = p."branchId"
       AND r."preparationId" = p."id"
      WHERE p."status" = 'LOCKED'
        AND p."finalSnapshot" IS NOT NULL
        AND s."officialDocumentNumber" IS NOT NULL
        AND s."status" <> 'CANCELLED'
      GROUP BY
        s."id", s."branchId", s."code", s."officialDocumentNumber", s."status",
        p."id", p."status"
      HAVING COUNT(DISTINCT d."id") > 0
      ORDER BY p."id" DESC
      LIMIT 20
    `);
    await client.query('COMMIT');

    const candidates = result.rows.map((row) => ({
      saleId: Number(row.saleId),
      branchId: Number(row.branchId),
      saleCode: row.saleCode,
      officialDocumentNumber: row.officialDocumentNumber,
      preparationId: Number(row.preparationId),
      taxDocumentCount: Number(row.taxDocumentCount),
      outputVatCount: Number(row.outputVatCount),
      replacementCount: Number(row.replacementCount),
      allTaxDocumentsRegistered: row.allTaxDocumentsRegistered === true,
      allTaxDocumentsIssued: row.allTaxDocumentsIssued === true,
      deliveryNoteActive: row.deliveryNoteActive === true,
      ready: row.allTaxDocumentsRegistered === true
        && row.allTaxDocumentsIssued === true
        && row.deliveryNoteActive === true,
    }));

    console.log(JSON.stringify({
      result: 'PASS',
      databaseModified: false,
      authority: {
        host: authority.target.host,
        port: authority.target.port,
        database: authority.target.database,
        projectRef: authority.target.projectRef,
      },
      candidateCount: candidates.length,
      recommended: candidates.find((candidate) => candidate.ready) || null,
      candidates,
    }, null, 2));
    console.log('Document replacement Wave 7C candidate discovery: PASS');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`DOCUMENT_REPLACEMENT_WAVE7C_DISCOVERY_FAILED: ${error.message || error}`);
  process.exitCode = 1;
});
