const service = require('./employeeOnboardingRuntimeService');

const addSubEmployee = async (req, res) => service.addSubEmployee(req, res);

module.exports = {
  addSubEmployee,
};
