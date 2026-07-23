const { decimal, sumMoney } = require('../utils/saleReturnMoney');

const buildRefundProjection = ({ command, serializedById, simpleById }) => {
  let eligibleTotal = decimal(0);
  let actualRefundTotal = decimal(0);
  const evaluatedItems = command.items.map((requested) => {
    const source = requested.kind === 'SIMPLE'
      ? simpleById.get(requested.saleItemSimpleId)
      : serializedById.get(requested.saleItemId);
    const eligible = requested.kind === 'SIMPLE'
      ? decimal(source.eligibleRefund).mul(decimal(requested.quantity)).div(decimal(source.eligibleQuantity))
      : decimal(source.eligibleRefund);
    eligibleTotal = eligibleTotal.plus(eligible);
    actualRefundTotal = actualRefundTotal.plus(decimal(requested.refundAmount));
    return { ...requested, source, eligibleRefund: eligible };
  });
  return {
    evaluatedItems,
    eligibleTotal,
    actualRefundTotal,
    refundEvidenceTotal: sumMoney(command.refunds.map((refund) => refund.amount)),
    deductedAmount: eligibleTotal.minus(actualRefundTotal),
  };
};

module.exports = { buildRefundProjection };
