const service = require('../service/missingCostResolutionMutationService');

const actorContext = (req) => ({
  branchId: req.user?.branchId,
  employeeId: req.user?.employeeId || req.user?.profileId,
});

const createDraft = async (req, res, next) => {
  try {
    const result = await service.createDraft({
      ...actorContext(req),
      input: req.body || {},
    });
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
};

const appendEvidence = async (req, res, next) => {
  try {
    const result = await service.appendEvidence({
      ...actorContext(req),
      resolutionId: req.params.resolutionId,
      input: req.body || {},
    });
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
};

const transition = async (req, res, next) => {
  try {
    const result = await service.transition({
      ...actorContext(req),
      resolutionId: req.params.resolutionId,
      input: req.body || {},
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createDraft,
  appendEvidence,
  transition,
};
