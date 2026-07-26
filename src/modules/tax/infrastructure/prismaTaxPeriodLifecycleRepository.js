const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');

const TAX_PERIOD_SELECT = Object.freeze({
  id: true,
  branchId: true,
  periodCode: true,
  startDate: true,
  endDate: true,
  status: true,
  closedAt: true,
  submittedAt: true,
  reopenedAt: true,
  lockedAt: true,
  createdAt: true,
  updatedAt: true,
});

const requireTaxPeriodLifecycleClient = (db) => {
  if (
    !db?.taxPeriod ||
    typeof db.taxPeriod.findFirst !== 'function' ||
    typeof db.taxPeriod.updateMany !== 'function'
  ) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_LIFECYCLE_CLIENT',
      'Tax period lifecycle requires Prisma taxPeriod findFirst and updateMany authority',
    );
  }
  return db;
};

const createPrismaTaxPeriodLifecycleRepository = ({ db }) => {
  const tx = requireTaxPeriodLifecycleClient(db);

  const findByIdAndBranch = ({ taxPeriodId, branchId }) => tx.taxPeriod.findFirst({
    where: { id: taxPeriodId, branchId },
    select: TAX_PERIOD_SELECT,
  });

  const transition = async ({ taxPeriodId, branchId, currentStatus, data }) => {
    const changed = await tx.taxPeriod.updateMany({
      where: {
        id: taxPeriodId,
        branchId,
        status: currentStatus,
      },
      data,
    });

    if (changed.count !== 1) {
      throw new TaxDocumentContractError(
        'TAX_PERIOD_LIFECYCLE_CONFLICT',
        'Tax period changed before the lifecycle transition could be persisted',
        { taxPeriodId, branchId, currentStatus, targetStatus: data.status },
      );
    }

    const taxPeriod = await findByIdAndBranch({ taxPeriodId, branchId });
    if (!taxPeriod) {
      throw new TaxDocumentContractError(
        'TAX_PERIOD_LIFECYCLE_RESULT_MISSING',
        'Tax period lifecycle transition committed but result could not be loaded',
        { taxPeriodId, branchId },
      );
    }
    return taxPeriod;
  };

  return Object.freeze({ findByIdAndBranch, transition });
};

module.exports = {
  TAX_PERIOD_SELECT,
  createPrismaTaxPeriodLifecycleRepository,
  requireTaxPeriodLifecycleClient,
};