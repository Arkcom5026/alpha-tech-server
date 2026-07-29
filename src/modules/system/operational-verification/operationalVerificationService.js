'use strict';

const { prisma, Prisma } = require('../../../../lib/prisma');

const CHECK_STATUS = Object.freeze({
  READY: 'READY',
  WARNING: 'WARNING',
  FAILED: 'FAILED',
});

const safeError = (error) => ({
  code: error?.code || 'OPERATIONAL_VERIFICATION_FAILED',
  message: error?.message || 'Operational verification failed',
});

const createCheck = (key, label, status, details = null) => Object.freeze({
  key,
  label,
  status,
  details,
});

const runCheck = async ({ key, label, query }) => {
  try {
    const details = await query();
    return createCheck(key, label, CHECK_STATUS.READY, details);
  } catch (error) {
    return createCheck(key, label, CHECK_STATUS.FAILED, safeError(error));
  }
};

const queryBoolean = async (sql) => {
  const rows = await prisma.$queryRaw(sql);
  return Boolean(rows?.[0]?.ready);
};

const createOperationalVerificationService = ({ clock = () => new Date() } = {}) => {
  const run = async () => {
    const checks = await Promise.all([
      runCheck({
        key: 'database',
        label: 'Database connectivity',
        query: async () => {
          await prisma.$queryRaw(Prisma.sql`SELECT 1 AS ready`);
          return { connected: true };
        },
      }),
      runCheck({
        key: 'productReservation',
        label: 'ProductReservation persistence authority',
        query: async () => {
          const ready = await queryBoolean(Prisma.sql`
            SELECT (
              to_regclass('"ProductReservation"') IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'ProductReservation'
                  AND column_name = 'stockReleasedAt'
              )
              AND EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'ProductReservation'
                  AND column_name = 'version'
              )
            ) AS ready
          `);
          if (!ready) throw Object.assign(new Error('ProductReservation lifecycle schema is incomplete'), { code: 'PRODUCT_RESERVATION_SCHEMA_INCOMPLETE' });
          return { table: true, stockReleasedAt: true, version: true };
        },
      }),
      runCheck({
        key: 'reservationLifecycle',
        label: 'Reservation lifecycle command and event authority',
        query: async () => {
          const ready = await queryBoolean(Prisma.sql`
            SELECT (
              to_regclass('"ProductReservationLifecycleCommand"') IS NOT NULL
              AND to_regclass('"ProductReservationLifecycleEvent"') IS NOT NULL
            ) AS ready
          `);
          if (!ready) throw Object.assign(new Error('ProductReservation lifecycle tables are incomplete'), { code: 'PRODUCT_RESERVATION_LIFECYCLE_TABLES_INCOMPLETE' });
          return { commandTable: true, eventTable: true };
        },
      }),
      runCheck({
        key: 'merchantProjection',
        label: 'Merchant reservation projection readiness',
        query: async () => {
          await prisma.$queryRaw(Prisma.sql`
            SELECT reservation."id"
            FROM "ProductReservation" reservation
            LEFT JOIN "ProductReservationItem" item
              ON item."reservationId" = reservation."id"
             AND item."isActive" = TRUE
            GROUP BY reservation."id"
            LIMIT 1
          `);
          return { queryReady: true };
        },
      }),
    ]);

    const failed = checks.filter((check) => check.status === CHECK_STATUS.FAILED).length;
    const warning = checks.filter((check) => check.status === CHECK_STATUS.WARNING).length;
    const status = failed > 0
      ? CHECK_STATUS.FAILED
      : warning > 0
        ? CHECK_STATUS.WARNING
        : CHECK_STATUS.READY;

    return Object.freeze({
      status,
      checkedAt: clock().toISOString(),
      summary: {
        total: checks.length,
        ready: checks.filter((check) => check.status === CHECK_STATUS.READY).length,
        warning,
        failed,
      },
      checks,
    });
  };

  return Object.freeze({ run });
};

module.exports = Object.freeze({
  CHECK_STATUS,
  createOperationalVerificationService,
});
