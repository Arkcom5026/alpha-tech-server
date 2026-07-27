const repository = require('./statusEmployeeRepository');
const { employeeProjection } = require('../shared/employeeMapper');
const { isSuperAdmin, normalizeRole, toInt } = require('../shared/employeeUtils');

const changeEmployeeStatus = async ({ actor = {}, employeeId, body = {} }) => {
  const id = toInt(employeeId);
  if (!id) return { status: 400, body: { message: 'id ไม่ถูกต้อง' } };

  const employee = await repository.findEmployeeById(id);
  if (!employee) return { status: 404, body: { message: 'ไม่พบพนักงาน' } };

  if (!isSuperAdmin(actor) && toInt(employee.branchId) !== toInt(actor.branchId)) {
    return { status: 403, body: { message: 'FORBIDDEN_BRANCH' } };
  }

  let nextActive;
  if (typeof body.active === 'boolean') {
    nextActive = body.active;
  } else if (['active', 'inactive'].includes(normalizeRole(body.status))) {
    nextActive = normalizeRole(body.status) === 'active';
  } else {
    return {
      status: 400,
      body: { message: 'กรุณาระบุ active เป็น boolean หรือ status เป็น active/inactive' },
    };
  }

  if (nextActive && !employee.approved) {
    return {
      status: 409,
      body: {
        code: 'EMPLOYEE_NOT_APPROVED',
        message: 'ไม่สามารถเปิดใช้งานพนักงานที่ยังไม่ได้รับอนุมัติ',
      },
    };
  }

  const updated = await repository.updateEmployeeStatus({
    id,
    userId: employee.userId,
    active: nextActive,
  });

  return {
    status: 200,
    body: {
      message: nextActive ? 'เปิดใช้งานพนักงานสำเร็จ' : 'ปิดใช้งานพนักงานสำเร็จ',
      employee: employeeProjection(updated),
    },
  };
};

module.exports = { changeEmployeeStatus };
