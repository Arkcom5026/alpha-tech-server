const { Prisma } = require('../../../../lib/prisma');

const D = (value) => new Prisma.Decimal(typeof value === 'string' ? value : Number(value));

const toNum = (value) =>
  value && typeof value === 'object' && 'toNumber' in value
    ? value.toNumber()
    : Number(value);

const isMoneyLike = (value) =>
  (typeof value === 'number' && !Number.isNaN(value)) ||
  (typeof value === 'string' && /^[0-9]+(\.[0-9]{1,2})?$/.test(value));

module.exports = {
  D,
  toNum,
  isMoneyLike,
};
