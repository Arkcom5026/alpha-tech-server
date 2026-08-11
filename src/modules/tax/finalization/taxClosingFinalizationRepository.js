'use strict';

const { prisma, Prisma } = require('../../../lib/prisma');

const mapRow = (row) => row ? Object.freeze({
  ...row,
  branchId: Number(row.branchId),
  version: Number(row.version),
  packageVersion: Number(row.packageVersion),
  finalizedById: row.finalizedById == null ? null : Number(row.finalizedById),
}) : null;

const findLatest = async ({ branchId, taxPeriodId }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT *
    FROM "TaxClosingFinalization"
    WHERE "branchId" = ${Number(branchId)}
      AND "taxPeriodId" = ${String(taxPeriodId)}
    ORDER BY "version" DESC
    LIMIT 1
  `);
  return mapRow(rows[0]);
};

const insertVersion = async ({
  branchId,
  taxPeriodId,
  version,
  packageVersion,
  snapshotHash,
  snapshot,
  manifest,
  finalizedById,
}, tx = prisma) => {
  const id = require('node:crypto').randomUUID();
  const snapshotJson = JSON.stringify(snapshot);
  const manifestJson = JSON.stringify(manifest);
  const rows = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "TaxClosingFinalization" (
      "id", "branchId", "taxPeriodId", "version", "packageVersion", "snapshotHash",
      "snapshot", "manifest", "finalizedById", "finalizedAt", "createdAt"
    ) VALUES (
      ${id}, ${Number(branchId)}, ${String(taxPeriodId)}, ${Number(version)}, ${Number(packageVersion)}, ${String(snapshotHash)},
      CAST(${snapshotJson} AS jsonb), CAST(${manifestJson} AS jsonb), ${finalizedById == null ? null : Number(finalizedById)}, NOW(), NOW()
    )
    RETURNING *
  `);
  return mapRow(rows[0]);
};

module.exports = Object.freeze({ findLatest, insertVersion });
