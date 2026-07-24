// @filename: src/modules/employee/validators/employeeValidator.js
// Employee domain validation boundary.

const normalize = (value) => String(value || '').trim();
const normalizeEmail = (value) => normalize(value).toLowerCase();

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const validateCreateEmployeeInput = (input = {}) => {
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

  return {
    name,
    email,
    password,
    phone,
    positionId,
  };
};

module.exports = {
  validateCreateEmployeeInput,
};
