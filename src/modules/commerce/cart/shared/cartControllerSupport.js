const toInt = (value) =>
  value === undefined || value === null || value === '' ? undefined : Number(value);

const toNum = (value) =>
  value && typeof value.toNumber === 'function' ? value.toNumber() : Number(value ?? 0);

module.exports = {
  toInt,
  toNum,
};
