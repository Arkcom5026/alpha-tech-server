const TAX_MONEY_SCALE = 2;
const TAX_ROUNDING_TOLERANCE = 0.01;

const normalizeTaxMoney = (value, field = 'amount', { allowNegative = false } = {}) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || (!allowNegative && amount < 0)) {
    throw new TypeError(`Invalid ${field}`);
  }
  return Math.round(amount * 100) / 100;
};

const taxMoneyMatches = (left, right, tolerance = TAX_ROUNDING_TOLERANCE) =>
  Math.abs(Number(left) - Number(right)) <= tolerance;

module.exports = {
  TAX_MONEY_SCALE,
  TAX_ROUNDING_TOLERANCE,
  normalizeTaxMoney,
  taxMoneyMatches,
};
