const toPositiveInt = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const requireBranchId = (req, res) => {
  const branchId = toPositiveInt(req.user?.branchId);

  if (!branchId) {
    res.status(403).json({
      code: 'BRANCH_CONTEXT_REQUIRED',
      message: 'ไม่พบข้อมูลสาขาสำหรับบัญชีผู้ใช้นี้',
    });
    return null;
  }

  return branchId;
};

module.exports = {
  requireBranchId,
  toPositiveInt,
};
