const service = require('./listRepairJobsService');
const { resolveRepairActor } = require('../../utils/repairActor');

async function listRepairJobs(req, res, next) {
  try {
    const actor = resolveRepairActor(req.user);
    const data = await service.execute(actor, req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = { listRepairJobs };
