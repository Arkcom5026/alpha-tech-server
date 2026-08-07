const { SaleCompletionError: SalesError } = require('../contracts/saleCompletionError');

const round2 = (value) => Math.round(Number(value) * 100) / 100;

const signedMoney = (value, field) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new SalesError(400, 'SALE_VALIDATION_FAILED', `Invalid ${field}`);
  }
  return round2(number);
};

const nonNegativeMoney = (value, field) => {
  const number = signedMoney(value, field);
  if (number < 0) {
    throw new SalesError(400, 'SALE_VALIDATION_FAILED', `Invalid ${field}`);
  }
  return number;
};

const normalizePriceAdjustment = ({
  basePrice,
  priceAdjustment,
  discount,
  price,
  adjustmentReason,
  fieldPrefix = 'item',
}) => {
  const base = nonNegativeMoney(basePrice, `${fieldPrefix}.basePrice`);
  const hasExplicitAdjustment = priceAdjustment !== undefined && priceAdjustment !== null && priceAdjustment !== '';
  const legacyDiscount = nonNegativeMoney(discount || 0, `${fieldPrefix}.discount`);
  const adjustment = hasExplicitAdjustment
    ? signedMoney(priceAdjustment, `${fieldPrefix}.priceAdjustment`)
    : round2(-legacyDiscount);
  const finalPrice = round2(base + adjustment);

  if (finalPrice < 0) {
    throw new SalesError(400, 'SALE_PRICE_ADJUSTMENT_BELOW_ZERO', 'Price adjustment cannot make the final price negative', {
      basePrice: base,
      priceAdjustment: adjustment,
      finalPrice,
    });
  }

  if (price !== undefined && price !== null && price !== '') {
    const suppliedPrice = nonNegativeMoney(price, `${fieldPrefix}.price`);
    if (Math.abs(suppliedPrice - finalPrice) > 0.01) {
      throw new SalesError(400, 'SALE_PRICE_ADJUSTMENT_MISMATCH', 'Final price does not match base price plus price adjustment', {
        basePrice: base,
        priceAdjustment: adjustment,
        suppliedPrice,
        finalPrice,
      });
    }
  }

  const reason = adjustmentReason == null ? null : String(adjustmentReason).trim() || null;
  const discountAmount = adjustment < 0 ? round2(-adjustment) : 0;

  return {
    basePrice: base,
    priceAdjustment: adjustment,
    finalPrice,
    adjustmentReason: reason,
    discountAmount,
  };
};

const summarizePriceAdjustments = (lines = []) => {
  const totalBeforeAdjustment = round2(lines.reduce((sum, line) => sum + Number(line.basePrice || 0), 0));
  const totalPriceAdjustment = round2(lines.reduce((sum, line) => sum + Number(line.priceAdjustment || 0), 0));
  const totalDiscount = round2(lines.reduce(
    (sum, line) => sum + (Number(line.priceAdjustment || 0) < 0 ? -Number(line.priceAdjustment || 0) : 0),
    0
  ));
  const totalAmount = round2(totalBeforeAdjustment + totalPriceAdjustment);

  if (totalAmount < 0) {
    throw new SalesError(400, 'SALE_PRICE_ADJUSTMENT_BELOW_ZERO', 'Price adjustments cannot make the sale total negative');
  }

  return { totalBeforeAdjustment, totalPriceAdjustment, totalDiscount, totalAmount };
};

module.exports = {
  normalizePriceAdjustment,
  signedMoney,
  summarizePriceAdjustments,
};
