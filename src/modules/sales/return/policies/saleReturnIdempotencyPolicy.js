const { SaleReturnError } = require('../contracts/saleReturnError');
const { SaleReturnFailureCode } = require('../contracts/saleReturnFailureCode');

const assertSaleReturnReplayHash = ({ storedHash, requestHash }) => {
  if (storedHash !== requestHash) {
    throw new SaleReturnError(
      409,
      SaleReturnFailureCode.COMMAND_MISMATCH,
      'commandId was already used with different return data'
    );
  }
};

module.exports = { assertSaleReturnReplayHash };
