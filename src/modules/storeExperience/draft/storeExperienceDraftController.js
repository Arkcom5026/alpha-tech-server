'use strict';

const service = require('./storeExperienceDraftService');

const branchIdOf = (req) => Number(req.employee?.branchId || req.user?.branchId);

const requireBranch = (req, res) => {
  const branchId = branchIdOf(req);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    res.status(403).json({ success: false, code: 'EMPLOYEE_BRANCH_CONTEXT_REQUIRED', message: 'ไม่พบร้านของผู้ดำเนินการ' });
    return null;
  }
  return branchId;
};

const sendError = (res, error) => res.status(error?.statusCode || 500).json({
  success: false,
  code: error?.code || 'STORE_EXPERIENCE_DRAFT_FAILED',
  message: error?.message || 'ดำเนินการตั้งค่าหน้าร้านไม่สำเร็จ',
});

const getCurrentDraft = async (req, res) => {
  try {
    const branchId = requireBranch(req, res);
    if (!branchId) return;
    return res.json({ success: true, data: await service.getDraftForBranch(branchId) });
  } catch (error) { return sendError(res, error); }
};

const saveCurrentDraft = async (req, res) => {
  try {
    const branchId = requireBranch(req, res);
    if (!branchId) return;
    return res.json({ success: true, data: await service.saveDraftForBranch(branchId, req.body || {}) });
  } catch (error) { return sendError(res, error); }
};

module.exports = { getCurrentDraft, saveCurrentDraft };
