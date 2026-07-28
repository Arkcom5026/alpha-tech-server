'use strict';

const {
  getPartnerStoreCapability,
  savePartnerStoreCapability,
} = require('./partnerStoreCapabilityService');

const resolvePositiveInt = (...values) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
};

const resolveBranchId = (req) => resolvePositiveInt(
  req.user?.branchId,
  req.user?.employeeBranchId,
  req.user?.currentBranchId
);

const getPartnerStoreCapabilityController = async (req, res, next) => {
  try {
    const data = await getPartnerStoreCapability({ branchId: resolveBranchId(req) });
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

const savePartnerStoreCapabilityController = async (req, res, next) => {
  try {
    const data = await savePartnerStoreCapability({
      ...req.body,
      branchId: resolveBranchId(req),
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({
  getPartnerStoreCapabilityController,
  savePartnerStoreCapabilityController,
});
