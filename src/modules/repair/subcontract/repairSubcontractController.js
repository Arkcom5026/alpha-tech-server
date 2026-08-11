const service = require('./repairSubcontractService');
const { resolveRepairActor } = require('../utils/repairActor');

async function getRepairSubcontractContext(req, res, next) {
  try {
    const actor = resolveRepairActor(req.user);
    const data = await service.getContext(actor, req.params.id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function sendRepairSubcontract(req, res, next) {
  try {
    const actor = resolveRepairActor(req.user);
    const data = await service.send(actor, req.params.id, req.body || {});
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function updateRepairSubcontract(req, res, next) {
  try {
    const actor = resolveRepairActor(req.user);
    const data = await service.updateDetails(
      actor,
      req.params.id,
      req.params.subcontractId,
      req.body || {}
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function commandRepairSubcontract(req, res, next) {
  try {
    const actor = resolveRepairActor(req.user);
    const data = await service.command(
      actor,
      req.params.id,
      req.params.subcontractId,
      req.body || {}
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getRepairSubcontractContext,
  sendRepairSubcontract,
  updateRepairSubcontract,
  commandRepairSubcontract,
};
