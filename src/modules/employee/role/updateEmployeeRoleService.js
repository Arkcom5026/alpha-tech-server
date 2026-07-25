const repository = require('./updateEmployeeRoleRepository');
const { isSuperAdmin, toInt, toPrismaRole } = require('../shared/employeeUtils');

const updateEmployeeUserRole = async ({ actor = {}, userId: rawUserId, role }) => {
  if (!isSuperAdmin(actor)) return { status: 403, body: { message: 'FORBIDDEN' } };

  const userId = toInt(rawUserId);
  const nextRole = toPrismaRole(role);

  if (!userId) return { status: 400, body: { message: 'userId ไม่ถูกต้อง' } };
  if (!nextRole || !['ADMIN', 'EMPLOYEE'].includes(nextRole)) {
    return { status: 400, body: { message: 'Allowed roles: admin หรือ employee เท่านั้น' } };
  }

  const profile = await repository.findEmployeeProfileByUserId(userId);
  if (!profile) return { status: 404, body: { message: 'ไม่พบข้อมูลพนักงาน' } };
  if (!profile.approved || !profile.active) {
    return {
      status: 400,
      body: { message: 'พนักงานต้องได้รับอนุมัติและอยู่ในสถานะใช้งานก่อนเปลี่ยน Role' },
    };
  }

  const updated = await repository.updateUserRole({ userId, role: nextRole });
  return {
    status: 200,
    body: { message: 'Role updated', user: { id: updated.id, role: updated.role } },
  };
};

module.exports = { updateEmployeeUserRole };
