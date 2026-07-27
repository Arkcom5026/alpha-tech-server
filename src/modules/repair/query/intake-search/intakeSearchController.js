const intakeSearchService = require('./intakeSearchService');
const { resolveRepairActor } = require('../../utils/repairActor');

async function searchIntake(req, res, next) {
  try {
    const actor = resolveRepairActor(req.user);
    const data = await intakeSearchService.execute(actor, req.query.q);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = { searchIntake };
