'use strict';

const money = (value) => Number(Number(value || 0).toFixed(2));
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value || 0)));

const projectWorkspaceReadLine = ({ sale, type, item, settledAmount = 0 }) => {
  const lineType = String(type || '').toUpperCase();
  const originalQuantity = lineType === 'STOCK' ? 1 : Math.max(0, Number(item?.quantity || 0));
  const returnedQuantity = clamp(item?.returnedQuantity, 0, originalQuantity);
  const activeQuantity = money(Math.max(0, originalQuantity - returnedQuantity));
  const originalAmount = money(item?.price);
  const returnedAmount = originalQuantity > 0
    ? money(originalAmount * (returnedQuantity / originalQuantity))
    : 0;
  const activeAmount = money(Math.max(0, originalAmount - returnedAmount));
  const normalizedSettled = money(settledAmount);
  const fullyReturned = activeQuantity <= 0;
  const status = fullyReturned
    ? 'RETURNED'
    : normalizedSettled >= activeAmount
      ? 'PAID_READY'
      : normalizedSettled > 0
        ? 'PARTIALLY_PAID'
        : 'UNPAID';

  return Object.freeze({
    saleId: Number(sale?.id),
    saleCode: sale?.code,
    sourceDocumentNo: sale?.officialDocumentNumber,
    soldAt: sale?.soldAt,
    lineType,
    lineId: Number(item?.id),
    status,
    description: item?.documentDescription || item?.product?.name || item?.stockItem?.product?.name || 'สินค้า',
    quantity: activeQuantity,
    originalQuantity: money(originalQuantity),
    returnedQuantity: money(returnedQuantity),
    activeQuantity,
    sourceUnitPrice: originalQuantity ? money(originalAmount / originalQuantity) : originalAmount,
    sourceAmount: activeAmount,
    originalAmount,
    returnedAmount,
    activeAmount,
    settledAmount: normalizedSettled,
    hasReturn: returnedQuantity > 0,
    fullyReturned,
    selectableForConsolidation: !fullyReturned && normalizedSettled >= activeAmount,
  });
};

const summarizeWorkspaceLines = (lines = []) => {
  const counts = lines.reduce((acc, line) => ({
    ...acc,
    [line.status]: (acc[line.status] || 0) + 1,
  }), {});
  const terminal = (line) => ['DOCUMENTED', 'RETURNED'].includes(line.status);
  const documentStatus = lines.length && lines.every(terminal)
    ? 'CLOSED'
    : lines.some(terminal)
      ? 'PARTIALLY_DOCUMENTED'
      : 'OPEN';
  return Object.freeze({
    counts,
    documentStatus,
    hasReturn: lines.some((line) => line.hasReturn),
    originalAmount: money(lines.reduce((sum, line) => sum + Number(line.originalAmount || 0), 0)),
    returnedAmount: money(lines.reduce((sum, line) => sum + Number(line.returnedAmount || 0), 0)),
    activeAmount: money(lines.reduce((sum, line) => sum + Number(line.activeAmount || 0), 0)),
  });
};

module.exports = Object.freeze({ projectWorkspaceReadLine, summarizeWorkspaceLines });
