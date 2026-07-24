// @filename: src/modules/employee/services/employeeService.js
// Employee domain service boundary.

const bcrypt = require('bcryptjs');
const employeeRepository = require('../repositories/employeeRepository');

const normalize = (value) => String(value || '').trim();
const normalizeEmail = (value) => normalize(value).toLowerCase();
const normalizeUpper = (value) => normalize(value).toUpperCase();

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const canCreateEmployee = (actor = {}) => {
  const systemRole = normalizeUpper(actor.role);
  const employeeRole = normalizeUpper(actor.employeeRole);

  return Boolean(
    actor.isSuperAdmin
      || systemRole === 'SUPERADMIN'
      || systemRole === 'ADMIN'
      || employeeRole === 'OWNER'
      || employeeRole === 'MANAGER'
  );
};

const createEmployee = async ({ prisma, actor, input }) => {
  if (!canCreateEmployee(actor)) {
    const error = new Error('EMPLOYEE_CREATE_FORBIDDEN');
    error.code = 'EMPLOYEE_CREATE_FORBIDDEN';
    throw error;
  }

  const branchId = toPositiveInt(actor.branchId || actor.employeeProfile?.branchId);
  const name = normalize(input.name);
  const email = normalizeEmail(input.email);
  const password = normalize(input.password);
  const phone = normalize(input.phone) || null;
  const positionId = toPositiveInt(input.positionId);

  if (!name || !email || !password || !positionId) {
    const error = new Error('EMPLOYEE_FIELDS_REQUIRED');
    error.code = 'EMPLOYEE_FIELDS_REQUIRED';
    throw error;
  }

  if (password.length < 6) {
    const error = new Error('EMPLOYEE_PASSWORD_TOO_SHORT');
    error.code = 'EMPLOYEE_PASSWORD_TOO_SHORT';
    throw error;
  }

  const [existingUser, position] = await Promise.all([
    employeeRepository.findEmployeeUserByEmail(email),
    employeeRepository.findPositionById(positionId),
  ]);

  if (existingUser) {
    const error = new Error('EMPLOYEE_EMAIL_ALREADY_EXISTS');
    error.code = 'EMPLOYEE_EMAIL_ALREADY_EXISTS';
    throw error;
  }

  if (!position) {
    const error = new Error('EMPLOYEE_POSITION_NOT_FOUND');
    error.code = 'EMPLOYEE_POSITION_NOT_FOUND';
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  return employeeRepository.createEmployee(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        loginId: email,
        password: passwordHash,
        role: 'EMPLOYEE',
        loginType: 'EMAIL',
        enabled: true,
      },
    });

    const employeeProfile = await tx.employeeProfile.create({
      data: {
        userId: user.id,
        branchId,
        positionId,
        name,
        phone,
        approved: true,
        active: true,
      },
      include: { position: true, branch: true },
    });

    await tx.customerProfile.create({
      data: {
        userId: user.id,
        name,
        type: 'INDIVIDUAL',
      },
    });

    return { user, employeeProfile };
  });
};

module.exports = {
  createEmployee,
};
