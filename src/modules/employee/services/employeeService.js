// @filename: src/modules/employee/services/employeeService.js
// Employee domain service boundary.

const bcrypt = require('bcryptjs');
const employeeRepository = require('../repositories/employeeRepository');
const { canManageEmployees } = require('../policies/employeeAuthorityPolicy');
const { validateCreateEmployeeInput } = require('../validators/employeeValidator');

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const createDomainError = (code) => {
  const error = new Error(code);
  error.code = code;
  return error;
};

const createEmployee = async ({ actor, input }) => {
  if (!canManageEmployees(actor)) {
    throw createDomainError('EMPLOYEE_CREATE_FORBIDDEN');
  }

  const branchId = toPositiveInt(actor.branchId || actor.employeeProfile?.branchId);
  if (!branchId) {
    throw createDomainError('EMPLOYEE_BRANCH_REQUIRED');
  }

  const {
    name,
    email,
    password,
    phone,
    positionId,
  } = validateCreateEmployeeInput(input);

  const [existingUser, position] = await Promise.all([
    employeeRepository.findEmployeeUserByEmail(email),
    employeeRepository.findPositionByIdForBranch(positionId, branchId),
  ]);

  if (existingUser) {
    throw createDomainError('EMPLOYEE_EMAIL_ALREADY_EXISTS');
  }

  if (!position) {
    throw createDomainError('EMPLOYEE_POSITION_NOT_FOUND');
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
