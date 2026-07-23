const { decimal } = require('../utils/saleReturnMoney');

const buildSerializedReturnMovement = ({ item, saleReturnId, branchId, employeeId, occurredAt, reason }) => ({
  productId: item.source.productId,
  branchId,
  qty: decimal(1),
  type: 'RETURN',
  refType: 'SALE_RETURN',
  refId: saleReturnId,
  note: item.reason || reason || null,
  stockItemId: item.source.stockItemId,
  previousStockStatus: 'SOLD',
  resultingStockStatus: 'IN_STOCK',
  performedByEmployeeId: employeeId,
  occurredAt,
});

const buildSimpleReturnMovement = ({ item, saleReturnId, branchId, employeeId, occurredAt, reason }) => ({
  productId: item.source.productId,
  branchId,
  qty: decimal(item.quantity),
  type: 'RETURN',
  refType: 'SALE_RETURN',
  refId: saleReturnId,
  note: item.reason || reason || null,
  simpleLotId: item.source.simpleLotId,
  performedByEmployeeId: employeeId,
  occurredAt,
});

module.exports = { buildSerializedReturnMovement, buildSimpleReturnMovement };
