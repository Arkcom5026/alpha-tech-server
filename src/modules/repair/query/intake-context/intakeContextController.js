const intakeContextService = require('./intakeContextService');
const { resolveRepairActor } = require('../../utils/repairActor');

async function getIntakeContext(req, res, next) {
  try {
    const actor = resolveRepairActor(req.user);
    const data = await intakeContextService.execute(actor, req.params.lookup);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getIntakeContext,
};
