const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');

const selectTaxPeriod = {
  id: true,
  branchId: true,
  periodCode: true,
  startDate: true,
  endDate: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

const requireTaxPeriodCreationClient = (db) => {
  const model = db?.taxPeriod;
  const requiredMethods = ['findUnique', 'findMany', 'create'];
  const missingMethods = requiredMethods.filter(
    (methodName) => typeof model?.[methodName] !== 'function',
  );

  if (missingMethods.length > 0) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_CREATION_CLIENT',
      'Tax period creation requires a Prisma taxPeriod client',
      { missingMethods },
    );
  }

  return model;
};

const createPrismaTaxPeriodCreationRepository = ({ db }) => {
  const taxPeriod = requireTaxPeriodCreationClient(db);

  const findByPeriodCode = ({ branchId, periodCode }) =>
    taxPeriod.findUnique({
      where: {
        branchId_periodCode: { branchId, periodCode },
      },
      select: selectTaxPeriod,
    });

  const findOverlapping = ({ branchId, startDate, endDate }) =>
    taxPeriod.findMany({
      where: {
        branchId,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      orderBy: [
        { startDate: 'asc' },
        { endDate: 'asc' },
        { id: 'asc' },
      ],
      select: selectTaxPeriod,
    });

  const create = ({ branchId, periodCode, startDate, endDate, status }) =>
    taxPeriod.create({
      data: {
        branchId,
        periodCode,
        startDate,
        endDate,
        status,
      },
      select: selectTaxPeriod,
    });

  return Object.freeze({
    create,
    findByPeriodCode,
    findOverlapping,
  });
};

module.exports = {
  createPrismaTaxPeriodCreationRepository,
  requireTaxPeriodCreationClient,
  selectTaxPeriod,
};