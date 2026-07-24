const { RepairError, RepairFailureCode } = require('../contracts/repairError');

function firstPositiveInteger(values) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function resolveRepairActor(user) {
  if (!user || typeof user !== 'object') {
    throw new RepairError(
      RepairFailureCode.ACTOR_CONTEXT_REQUIRED,
      'ไม่พบข้อมูลผู้ใช้งานสำหรับดำเนินการรับซ่อมหรือรับเคลม',
      401
    );
  }

  const branchId = firstPositiveInteger([
    user.branchId,
    user.employeeProfile?.branchId,
    user.employee?.branchId,
  ]);

  if (!branchId) {
    throw new RepairError(
      RepairFailureCode.BRANCH_REQUIRED,
      'ผู้ใช้งานยังไม่ได้ผูกกับสาขาที่ใช้ดำเนินการ',
      403
    );
  }

  const employeeId = firstPositiveInteger([
    user.employeeId,
    user.employeeProfileId,
    user.employeeProfile?.id,
    user.employee?.id,
  ]);

  return {
    branchId,
    employeeId,
    role: user.v2Role || user.role || user.employeeProfile?.v2Role || null,
    userId: firstPositiveInteger([user.id, user.userId]),
  };
}

module.exports = {
  resolveRepairActor,
};
