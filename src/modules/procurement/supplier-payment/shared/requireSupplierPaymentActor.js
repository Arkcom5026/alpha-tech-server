const requireSupplierPaymentActor = (req, res, next) => {
  const branchId = Number(req.user?.branchId);
  const employeeId = Number(req.user?.employeeId);

  if (!Number.isInteger(branchId) || branchId <= 0) {
    return res.status(403).json({
      code: 'BRANCH_CONTEXT_REQUIRED',
      message: 'ไม่พบสาขาของพนักงานผู้ทำรายการ',
    });
  }

  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return res.status(403).json({
      code: 'EMPLOYEE_CONTEXT_REQUIRED',
      message: 'ไม่พบข้อมูลพนักงานผู้ทำรายการ',
    });
  }

  return next();
};

module.exports = { requireSupplierPaymentActor };
