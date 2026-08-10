'use strict';

const { prisma, Prisma } = require('../../../../lib/prisma');

const fail = (code, message, statusCode = 400, details = undefined) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  if (details) error.details = details;
  throw error;
};

const positiveInt = (value, code, label) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) fail(code, `${label} must be a positive integer`);
  return parsed;
};

const ALLOWED_TRANSITIONS = Object.freeze({
  PENDING_REVIEW: Object.freeze(['WITHHOLDING_REQUIRED']),
  WITHHOLDING_REQUIRED: Object.freeze(['WITHHELD']),
});

const transitionWhtTreatment = async ({
  branchId,
  taxExpenseItemId,
  resultingTreatment,
  actorEmployeeId,
  note,
}, database = prisma) => database.$transaction(async (tx) => {
  const normalizedBranchId = positiveInt(branchId, 'WHT_BRANCH_REQUIRED', 'branchId');
  const normalizedItemId = positiveInt(taxExpenseItemId, 'WHT_ITEM_REQUIRED', 'taxExpenseItemId');
  const normalizedActorId = positiveInt(actorEmployeeId, 'WHT_ACTOR_REQUIRED', 'actorEmployeeId');
  const target = String(resultingTreatment || '').trim().toUpperCase();
  const normalizedNote = String(note || '').trim() || null;

  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT
      item."id", item."taxExpenseId", item."branchId", item."whtTreatment"::text AS "whtTreatment",
      item."withholdingTaxRate", item."withholdingTaxAmount",
      expense."status"::text AS "expenseStatus",
      certificate."status"::text AS "certificateStatus",
      EXISTS (
        SELECT 1
        FROM "TaxPeriod" period
        WHERE period."branchId" = expense."branchId"
          AND period."status" = 'SUBMITTED'::"TaxPeriodStatus"
          AND expense."expenseDate" >= period."startDate"
          AND expense."expenseDate" <= period."endDate"
      ) AS "submittedPeriodLocked"
    FROM "TaxExpenseItem" item
    JOIN "TaxExpense" expense
      ON expense."id" = item."taxExpenseId"
     AND expense."branchId" = item."branchId"
    LEFT JOIN "WithholdingTaxCertificate" certificate
      ON certificate."taxExpenseId" = expense."id"
     AND certificate."branchId" = expense."branchId"
    WHERE item."id" = ${normalizedItemId}
      AND item."branchId" = ${normalizedBranchId}
    LIMIT 1
    FOR UPDATE OF item
  `);
  const item = rows[0];
  if (!item) fail('WHT_ITEM_NOT_FOUND', 'Tax expense item was not found', 404);
  if (item.expenseStatus === 'VOIDED') fail('WHT_EXPENSE_IMMUTABLE', 'Voided tax expense cannot change WHT treatment', 409);
  if (item.submittedPeriodLocked) fail('WHT_PERIOD_IMMUTABLE', 'WHT treatment cannot change after the tax period is submitted', 409);
  if (item.certificateStatus === 'ISSUED') fail('WHT_TREATMENT_CERTIFICATE_LOCKED', 'WHT treatment cannot change after certificate issuance', 409);

  const previous = String(item.whtTreatment);
  const allowed = ALLOWED_TRANSITIONS[previous] || [];
  if (!allowed.includes(target)) {
    fail('WHT_TREATMENT_TRANSITION_INVALID', `Cannot transition WHT treatment from ${previous} to ${target || '(empty)'}`, 409, {
      previousTreatment: previous,
      requestedTreatment: target,
      allowedTreatments: allowed,
    });
  }
  if (Number(item.withholdingTaxRate || 0) <= 0 || Number(item.withholdingTaxAmount || 0) <= 0) {
    fail('WHT_TREATMENT_AMOUNT_REQUIRED', 'Positive WHT rate and amount are required before confirming WHT treatment', 409);
  }

  const updatedRows = await tx.$queryRaw(Prisma.sql`
    UPDATE "TaxExpenseItem"
    SET "whtTreatment" = ${target}::"TaxExpenseWhtTreatment"
    WHERE "id" = ${normalizedItemId}
      AND "branchId" = ${normalizedBranchId}
      AND "whtTreatment" = ${previous}::"TaxExpenseWhtTreatment"
    RETURNING "id", "taxExpenseId", "branchId", "whtTreatment"::text AS "whtTreatment", "withholdingTaxRate", "withholdingTaxAmount"
  `);
  if (updatedRows.length !== 1) fail('WHT_TREATMENT_CONCURRENT_MODIFICATION', 'WHT treatment changed concurrently; refresh and try again', 409);

  await tx.$queryRaw(Prisma.sql`
    INSERT INTO "WithholdingTaxTreatmentEvent" (
      "id", "branchId", "taxExpenseId", "taxExpenseItemId", "previousTreatment", "resultingTreatment",
      "actorEmployeeId", "note", "occurredAt", "createdAt"
    ) VALUES (
      CONCAT('whte_', md5(random()::text || clock_timestamp()::text)),
      ${normalizedBranchId}, ${item.taxExpenseId}, ${normalizedItemId},
      ${previous}::"TaxExpenseWhtTreatment", ${target}::"TaxExpenseWhtTreatment",
      ${normalizedActorId}, ${normalizedNote}, NOW(), NOW()
    )
  `);

  return Object.freeze({
    ...updatedRows[0],
    withholdingTaxRate: Number(updatedRows[0].withholdingTaxRate || 0),
    withholdingTaxAmount: Number(updatedRows[0].withholdingTaxAmount || 0),
    previousTreatment: previous,
  });
});

module.exports = Object.freeze({ ALLOWED_TRANSITIONS, transitionWhtTreatment });
