'use strict';

const { prisma, Prisma } = require('../../../lib/prisma');

const mapCandidateRow = (row) => ({
  ...row,
  id: Number(row.id),
  branchId: Number(row.branchId),
});

const mapDocumentRow = (row) => ({
  ...row,
  id: Number(row.id),
  branchId: Number(row.branchId),
  candidateId: row.candidateId == null ? null : Number(row.candidateId),
});

const boundedPage = ({ limit = 50, offset = 0 } = {}) => ({
  limit: Math.min(Math.max(Number(limit) || 50, 1), 200),
  offset: Math.max(Number(offset) || 0, 0),
});

const listCandidatesForPeriod = async ({
  branchId,
  startDate,
  endDate,
  status,
  sourceType,
  limit,
  offset,
}, tx = prisma) => {
  const page = boundedPage({ limit, offset });
  const filters = [
    Prisma.sql`candidate."branchId" = ${Number(branchId)}`,
    Prisma.sql`candidate."occurredAt" >= ${startDate}`,
    Prisma.sql`candidate."occurredAt" <= ${endDate}`,
  ];
  if (status) filters.push(Prisma.sql`candidate."status"::text = ${status}`);
  if (sourceType) filters.push(Prisma.sql`candidate."sourceType" = ${sourceType}`);

  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT candidate.*
    FROM "TaxCandidate" candidate
    WHERE ${Prisma.join(filters, ' AND ')}
    ORDER BY candidate."occurredAt" DESC, candidate."id" DESC
    LIMIT ${page.limit} OFFSET ${page.offset}
  `);
  return rows.map(mapCandidateRow);
};

const listDocumentsForPeriod = async ({
  branchId,
  startDate,
  endDate,
  status,
  documentType,
  limit,
  offset,
}, tx = prisma) => {
  const page = boundedPage({ limit, offset });
  const filters = [
    Prisma.sql`document."branchId" = ${Number(branchId)}`,
    Prisma.sql`document."occurredAt" >= ${startDate}`,
    Prisma.sql`document."occurredAt" <= ${endDate}`,
  ];
  if (status) filters.push(Prisma.sql`document."status" = ${status}`);
  if (documentType) filters.push(Prisma.sql`document."documentType" = ${documentType}`);

  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT document.*
    FROM "TaxDocument" document
    WHERE ${Prisma.join(filters, ' AND ')}
    ORDER BY document."occurredAt" DESC, document."id" DESC
    LIMIT ${page.limit} OFFSET ${page.offset}
  `);
  return rows.map(mapDocumentRow);
};

module.exports = Object.freeze({
  listCandidatesForPeriod,
  listDocumentsForPeriod,
});
