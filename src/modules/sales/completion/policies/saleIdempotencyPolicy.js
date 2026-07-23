const { SaleCompletionError } = require('../contracts/saleCompletionError');

const assertSaleReplayHash = ({ storedHash, requestHash }) => {
  if (storedHash !== requestHash) {
    throw new SaleCompletionError(
      409,
      'IDEMPOTENCY_PAYLOAD_MISMATCH',
      'commandId was already used with a different payload'
    );
  }
};

module.exports = { assertSaleReplayHash };
