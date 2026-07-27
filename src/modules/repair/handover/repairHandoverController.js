const service = require('./repairHandoverService');

const actor = (req) => ({ branchId: req.user.branchId, employeeId: req.user.employeeId });

exports.confirmPublicPickup = async (req, res, next) => {
  try {
    res.status(200).json({ status: 'success', data: await service.confirmPublic(req.params.token, req.body) });
  } catch (error) { next(error); }
};
exports.getRepairHandover = async (req, res, next) => {
  try {
    res.json({ status: 'success', data: await service.getStaff(actor(req), req.params.id) });
  } catch (error) { next(error); }
};
exports.finalizeRepairHandover = async (req, res, next) => {
  try {
    res.json({ status: 'success', data: await service.finalize(actor(req), req.params.id, req.body) });
  } catch (error) { next(error); }
};
