const { SaleReturnError } = require('../contracts/saleReturnError');
const { SaleReturnFailureCode } = require('../contracts/saleReturnFailureCode');

const assertSerializedReturnable = (source) => {
  if (!source || source.eligibleQuantity !== 1 || source.status !== 'SOLD') {
    throw new SaleReturnError(409, SaleReturnFailureCode.STOCK_CONFLICT, 'Serialized item is not returnable');
  }
};

const assertSimpleReturnable = (source, quantity) => {
  if (!source || quantity > source.eligibleQuantity + 0.0001 || !source.simpleLotId) {
    throw new SaleReturnError(409, SaleReturnFailureCode.QUANTITY_CONFLICT, 'Simple item quantity is not returnable');
  }
};

module.exports = { assertSerializedReturnable, assertSimpleReturnable };
