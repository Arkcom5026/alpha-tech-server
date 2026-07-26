const repository = require('./listReceiptsReadyToPayRepository');

const execute = async ({ branchId, startDate, endDate, limit }) => {
  if (!branchId) return { status: 401, body: { error: 'unauthorized' } };
  const items = await repository.list({ branchId, startDate, endDate, limit });
  return { status: 200, body: items };
};

module.exports = { execute };
