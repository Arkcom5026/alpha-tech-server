const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');

const requireAdministrativeClient = (db) => {
  if (
    !db?.taxPeriod ||
    typeof db.taxPeriod.findMany !== 'function' ||
    typeof db.taxPeriod.findFirst !== 'function' ||
    typeof db.taxPeriod.groupBy !== 'function'
  ) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_ADMINISTRATIVE_CLIENT',
      'Tax period administration requires a Prisma taxPeriod client',
    );
  }

  return db;
};

const selectTaxPeriod = {
  id: true,
  branchId: true,
  periodCode: true,
  startDate: true,
  endDate: true,
  status: true,
  closedAt: true,
  lockedAt: true,
  submittedAt: true,
  reopenedAt: true,
  createdAt: true,
  updatedAt: true,
};

const createPrismaTaxPeriodAdministrativeRepository = ({ db }) => {
  const client = requireAdministrativeClient(db);

  const findByIdAndBranch = async ({ taxPeriodId, branchId }) =>
    client.taxPeriod.findFirst({
      where: {
        id: taxPeriodId,
        branchId,
      },
      select: selectTaxPeriod,
    });

  const list = async ({ branchId, fromDate = null, toDate = null, statuses = [] }) =>
    client.taxPeriod.findMany({
      where: {
        branchId,
        ...(fromDate ? { endDate: { gte: fromDate } } : {}),
        ...(toDate ? { startDate: { lte: toDate } } : {}),
        ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
      },
      orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
      select: selectTaxPeriod,
    });

  const summarize = async ({ branchId, referenceDate }) => {
    const [groups, currentPeriod] = await Promise.all([
      client.taxPeriod.groupBy({
        by: ['status'],
        where: { branchId },
        _count: { _all: true },
      }),
      client.taxPeriod.findFirst({
        where: {
          branchId,
          startDate: { lte: referenceDate },
          endDate: { gte: referenceDate },
        },
        orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
        select: selectTaxPeriod,
      }),
    ]);

    return Object.freeze({
      statusGroups: Object.freeze(
        groups.map((group) => Object.freeze({
          status: group.status,
          count: group._count._all,
        })),
      ),
      currentPeriod,
    });
  };

  return Object.freeze({ findByIdAndBranch, list, summarize });
};

module.exports = {
  createPrismaTaxPeriodAdministrativeRepository,
  requireAdministrativeClient,
  selectTaxPeriod,
};