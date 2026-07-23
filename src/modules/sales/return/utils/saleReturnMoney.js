const { Prisma } = require('../../../../../lib/prisma');

const decimal = (value) => new Prisma.Decimal(Number(value || 0).toFixed(2));
const number = (value) => Number(decimal(value));
const moneyEquals = (left, right) => Math.abs(number(left) - number(right)) < 0.005;
const sumMoney = (values) => values.reduce((total, value) => total.plus(decimal(value)), decimal(0));

module.exports = { decimal, number, moneyEquals, sumMoney };
