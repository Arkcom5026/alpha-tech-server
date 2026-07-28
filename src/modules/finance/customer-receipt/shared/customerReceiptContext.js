const getBranchIdFromRequest = (req) => {
  const branchId = Number(req?.user?.branchId);
  return Number.isInteger(branchId) && branchId > 0 ? branchId : null;
};

const getEmployeeProfileIdFromRequest = (req) => {
  const employeeProfileId = Number(
    req?.user?.employeeProfileId ?? req?.user?.employeeId ?? req?.employee?.id
  );

  return Number.isInteger(employeeProfileId) && employeeProfileId > 0
    ? employeeProfileId
    : null;
};

const ensureBranchContext = (req, res) => {
  const branchId = getBranchIdFromRequest(req);
  if (!branchId) {
    res.status(400).json({
      success: false,
      message: 'ไม่พบ branchId ใน session ผู้ใช้งาน',
    });
    return null;
  }
  return branchId;
};

const ensureEmployeeContext = (req, res) => {
  const employeeProfileId = getEmployeeProfileIdFromRequest(req);
  if (!employeeProfileId) {
    res.status(400).json({
      success: false,
      message: 'ไม่พบข้อมูลพนักงานผู้ทำรายการ',
    });
    return null;
  }
  return employeeProfileId;
};

const ensureEmployeeBelongsToBranchOrThrow = async (
  tx,
  { employeeProfileId, branchId }
) => {
  const employeeProfile = await tx.employeeProfile.findFirst({
    where: {
      id: employeeProfileId,
      branchId,
    },
    select: { id: true },
  });

  if (!employeeProfile) {
    const error = new Error('ไม่พบพนักงานผู้ทำรายการในสาขานี้');
    error.statusCode = 404;
    throw error;
  }
};

module.exports = {
  getBranchIdFromRequest,
  getEmployeeProfileIdFromRequest,
  ensureBranchContext,
  ensureEmployeeContext,
  ensureEmployeeBelongsToBranchOrThrow,
};
