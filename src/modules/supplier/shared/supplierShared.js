const { Prisma } = require('../../../../lib/prisma');

const toInt = (value) =>
  value === undefined || value === null || value === '' ? undefined : Number(value);

const toNum = (value) =>
  value && typeof value.toNumber === 'function' ? value.toNumber() : Number(value ?? 0);

const omitUndefined = (object) =>
  Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));

const decimal = (value) =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value ?? 0);

const mapSupplierCredit = (supplier) => ({
  ...supplier,
  creditLimit: toNum(supplier.creditLimit),
  creditBalance: toNum(supplier.creditBalance),
});

module.exports = {
  decimal,
  mapSupplierCredit,
  omitUndefined,
  toInt,
  toNum,
};
