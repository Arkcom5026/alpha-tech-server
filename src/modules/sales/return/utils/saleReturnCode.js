const dayjs = require('dayjs');

const generateSaleReturnCode = async (client, branchId) => {
  const now = dayjs();
  const prefix = `RT-${String(branchId).padStart(2, '0')}${now.format('YYMM')}`;
  const count = await client.saleReturn.count({
    where: {
      branchId,
      createdAt: {
        gte: now.startOf('month').toDate(),
        lt: now.endOf('month').toDate(),
      },
    },
  });
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
};

module.exports = { generateSaleReturnCode };
