const repairRepository = require('../repositories/repairRepository');
const { validateLookup } = require('../validators/repairValidator');
const { mapIntakeContext } = require('../mappers/repairIntakeMapper');
const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');

class RepairIntakeService {
  constructor(repository = repairRepository) {
    this.repository = repository;
  }

  async getContext(actor, rawLookup) {
    const lookup = validateLookup(rawLookup);
    const stockItem = await this.repository.findStockItemForIntake(
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
}

module.exports = new RepairIntakeService();
module.exports.RepairIntakeService = RepairIntakeService;
