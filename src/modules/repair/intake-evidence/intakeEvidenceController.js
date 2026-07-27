const service = require('./intakeEvidenceService');
const { resolveRepairActor } = require('../utils/repairActor');

async function getIntakeEvidence(req, res, next) {
  try {
    const data = await service.get(resolveRepairActor(req.user), req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

async function saveIntakeEvidence(req, res, next) {
  try {
    const data = await service.save(
      resolveRepairActor(req.user),
      req.params.id,
      req.body,
      req.files || []
    );
    return res.status(201).json({
      success: true,
      message: 'บันทึกหลักฐานและคำยืนยันการรับเครื่องแล้ว',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getIntakeEvidence, saveIntakeEvidence };
