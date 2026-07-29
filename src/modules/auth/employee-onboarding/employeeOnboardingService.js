const employeeOnboardingRepository = require('./employeeOnboardingRepository');
const { bcryptHash } = require('../shared/passwordHasher');

const createEmployee = async ({ branchId, name, email, password, phone, v2Role, positionId }) => {
  const [existingUser, position] = await Promise.all([
    employeeOnboardingRepository.findUserByEmail(email),
    employeeOnboardingRepository.findPositionById(positionId),
  ]);

  if (existingUser) return { conflict: 'EMAIL' };
  if (!position) return { invalid: 'POSITION' };

  const passwordHash = await bcryptHash(password, 10);
  const created = await employeeOnboardingRepository.createEmployee({
    branchId,
    positionId,
    name,
    email,
    phone,
    v2Role,
    passwordHash,
  });

  console.log(
    `👥 [Employee Onboarding] "${name}" created for Branch ID: ${branchId}, Position ID: ${positionId}`,
  );

  return {
    response: {
      ok: true,
      message: `สร้างบัญชีพนักงาน "${name}" สำเร็จและพร้อมใช้งานทันที`,
      data: {
        userId: created.user.id,
        employeeId: created.employeeProfile.id,
        name: created.employeeProfile.name,
        email: created.user.email,
        phone: created.employeeProfile.phone,
        v2Role: created.employeeProfile.v2Role,
        positionId: created.employeeProfile.positionId,
        position: created.employeeProfile.position,
        branchId: created.employeeProfile.branchId,
        branch: created.employeeProfile.branch,
        approved: created.employeeProfile.approved,
        active: created.employeeProfile.active,
        enabled: created.user.enabled,
      },
    },
  };
};

module.exports = { createEmployee };
