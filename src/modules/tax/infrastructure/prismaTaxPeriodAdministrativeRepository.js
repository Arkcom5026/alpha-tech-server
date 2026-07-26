const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');

const requireAdministrativeClient = (db) => {
  if (!db?.taxPeriod || typeof db.taxPeriod.findMany !== 'function') {
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

  return Object.freeze({ list });
};

module.exports = {
  createPrismaTaxPeriodAdministrativeRepository,
  requireAdministrativeClient,
  selectTaxPeriod,
};
