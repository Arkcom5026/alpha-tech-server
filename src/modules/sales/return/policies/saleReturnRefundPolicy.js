const { SaleReturnError } = require('../contracts/saleReturnError');
const { SaleReturnFailureCode } = require('../contracts/saleReturnFailureCode');
const { moneyEquals, number } = require('../utils/saleReturnMoney');

const assertRefundProjection = ({ command, projection, paymentItemsById }) => {
  for (const item of projection.evaluatedItems) {
    if (item.refundAmount > number(item.eligibleRefund) + 0.005) {
      throw new SaleReturnError(400, SaleReturnFailureCode.REFUND_EXCEEDS_ELIGIBLE, 'Refund exceeds original net value');
    }
  }
  if (!moneyEquals(projection.actualRefundTotal, projection.refundEvidenceTotal)) {
    throw new SaleReturnError(400, SaleReturnFailureCode.REFUND_EVIDENCE_MISMATCH, 'Refund channels must equal the actual refund');
  }
  if (projection.deductedAmount.lt(0)) {
    throw new SaleReturnError(400, SaleReturnFailureCode.REFUND_EXCEEDS_ELIGIBLE, 'Refund exceeds eligible value');
  }
  if (
    projection.deductedAmount.gt(0) &&
    !command.reason &&
    projection.evaluatedItems.some((item) => !item.reason)
  ) {
    throw new SaleReturnError(400, SaleReturnFailureCode.DEDUCTION_REASON_REQUIRED, 'A free-text reason is required when refund is deducted');
  }
  const requestedBySource = new Map();
  for (const refund of command.refunds) {
    if (!refund.sourcePaymentItemId) continue;
    const source = paymentItemsById.get(refund.sourcePaymentItemId);
    if (!source) {
      throw new SaleReturnError(400, SaleReturnFailureCode.INVALID_SOURCE_PAYMENT, 'Refund source does not belong to this sale');
    }
    const requested = (requestedBySource.get(refund.sourcePaymentItemId) || 0) + refund.amount;
    if (requested > source.remainingRefundableAmount + 0.005) {
      throw new SaleReturnError(
        400,
        SaleReturnFailureCode.INVALID_SOURCE_PAYMENT,
        'Refund exceeds the remaining amount of its source payment'
      );
    }
    requestedBySource.set(refund.sourcePaymentItemId, requested);
  }
};

module.exports = { assertRefundProjection };
