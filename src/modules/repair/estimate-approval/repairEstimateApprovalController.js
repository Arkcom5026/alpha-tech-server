const service = require('./repairEstimateApprovalService');
const { resolveRepairActor } = require('../utils/repairActor');

async function publishEstimateApproval(req, res, next) {
  try {
    const data = await service.publish(
      resolveRepairActor(req.user),
      req.params.id,
      req.body || {}
    );
    return res.status(201).json({
      success: true,
      message: 'ส่งราคาประเมินให้ลูกค้าพิจารณาแล้ว',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function getLatestEstimateApproval(req, res, next) {
  try {
    const data = await service.getLatestForStaff(
      resolveRepairActor(req.user),
      req.params.id
    );
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

async function decidePublicEstimateApproval(req, res, next) {
  try {
    const data = await service.decideByTrackingToken(
      req.params.token,
      req.body || {}
    );
    return res.json({
      success: true,
      message: data.status === 'APPROVED'
        ? 'ยืนยันอนุมัติราคาประเมินแล้ว'
        : 'ส่งผลไม่อนุมัติราคาประเมินแล้ว',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  publishEstimateApproval,
  getLatestEstimateApproval,
  decidePublicEstimateApproval,
};
