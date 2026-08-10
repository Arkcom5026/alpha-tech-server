const { resolveRepairActor } = require('../../utils/repairActor');
const service = require('./getRepairPartStockOptionsService');

async function getRepairPartStockOptions(req, res, next) {
  try {
    const actor = resolveRepairActor(req.user);
    const data = await service.execute(actor, req.params.id, req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = { getRepairPartStockOptions };
