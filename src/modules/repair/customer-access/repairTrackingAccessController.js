const service = require('./repairTrackingAccessService');
const { resolveRepairActor } = require('../utils/repairActor');

async function createTrackingAccess(req, res, next) {
  try {
    const actor = resolveRepairActor(req.user);
    const data = await service.issue(actor, req.params.id, req.body || {});
    res.status(201).json({
      success: true,
      message: 'สร้างลิงก์ติดตามงานเรียบร้อยแล้ว',
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function rotateTrackingAccess(req, res, next) {
  try {
    const actor = resolveRepairActor(req.user);
    const data = await service.rotate(actor, req.params.id, req.body || {});
    res.status(200).json({
      success: true,
      message: 'ออกลิงก์ติดตามงานใหม่เรียบร้อยแล้ว',
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function revokeTrackingAccess(req, res, next) {
  try {
    const actor = resolveRepairActor(req.user);
    const data = await service.revoke(actor, req.params.id);
    res.status(200).json({
      success: true,
      message: 'ยกเลิกลิงก์ติดตามงานเรียบร้อยแล้ว',
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function getPublicRepairTracking(req, res, next) {
  try {
    const data = await service.getPublicTracking(req.params.token);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createTrackingAccess,
  rotateTrackingAccess,
  revokeTrackingAccess,
  getPublicRepairTracking,
};
