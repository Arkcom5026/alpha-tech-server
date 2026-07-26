const service = require('./repairJobDetailService');
const { resolveRepairActor } = require('../../utils/repairActor');

async function getRepairJobDetail(req, res, next) {
  try {
    const actor = resolveRepairActor(req.user);
    const data = await service.execute(actor, req.params.id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = { getRepairJobDetail };
