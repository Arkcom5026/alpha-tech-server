const intakeContextRepository = require('./intakeContextRepository');
const { validateLookup } = require('../../validators/repairValidator');
const { mapIntakeContext } = require('../../mappers/repairIntakeMapper');
const {
  RepairError,
  RepairFailureCode,
} = require('../../contracts/repairError');

class IntakeContextService {
  constructor(repository = intakeContextRepository) {
    this.repository = repository;
  }

  async execute(actor, rawLookup) {
    const lookup = validateLookup(rawLookup);
    const findByLookup =
      this.repository.findByLookup || this.repository.findStockItemForIntake;

    const stockItem = await findByLookup.call(
      this.repository,
      actor.branchId,
      lookup
    );

    if (!stockItem) {
      throw new RepairError(
        RepairFailureCode.STOCK_ITEM_NOT_FOUND,
        'ไม่พบสินค้าจากบาร์โค้ดหรือหมายเลขซีเรียลในสาขานี้',
        404,
        { lookup }
      );
    }

    return mapIntakeContext(stockItem);
  }

  getContext(actor, rawLookup) {
    return this.execute(actor, rawLookup);
  }
}

module.exports = new IntakeContextService();
module.exports.IntakeContextService = IntakeContextService;
