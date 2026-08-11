'use strict';

const { prisma, Prisma } = require('../../../lib/prisma');

const normalizeJson = (value) => {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (value && typeof value === 'object') {
    if (value.constructor?.name === 'Decimal' && typeof value.toString === 'function') return value.toString();
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalizeJson(entry)]));
  }
  return value;
};

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
  const snapshotJson = JSON.stringify(normalizeJson(snapshot));
  const manifestJson = JSON.stringify(normalizeJson(manifest));
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

module.exports = Object.freeze({ findLatest, insertVersion, normalizeJson });
