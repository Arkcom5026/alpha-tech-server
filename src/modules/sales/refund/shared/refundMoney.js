const { Prisma } = require('../../../../../lib/prisma');

const toDecimal = (value) =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value ?? 0);

module.exports = {
  toDecimal,
};
