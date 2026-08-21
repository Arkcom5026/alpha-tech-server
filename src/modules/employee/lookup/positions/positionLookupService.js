const positionLookupRepository = require('./positionLookupRepository');

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const listPositions = ({ branchId }) => {
  const normalizedBranchId = toPositiveInt(branchId);
  if (!normalizedBranchId) {
    const error = new Error('EMPLOYEE_POSITION_LOOKUP_BRANCH_REQUIRED');
    error.statusCode = 403;
    error.code = 'EMPLOYEE_POSITION_LOOKUP_BRANCH_REQUIRED';
    throw error;
  }

  return positionLookupRepository.listPositions({ branchId: normalizedBranchId });
};

module.exports = { listPositions };
