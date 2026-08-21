const { SaleReturnError } = require('../contracts/saleReturnError');
const { SaleReturnFailureCode } = require('../contracts/saleReturnFailureCode');
const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');

const assertCanApproveDeductedRefund = ({ deductedAmount, actor }) => {
  if (!deductedAmount.gt(0)) return;
  if (!hasCapability(actor, POSITION_CAPABILITIES.SALES_RETURN_DEDUCTION_APPROVE)) {
    throw new SaleReturnError(
      403,
      SaleReturnFailureCode.DEDUCTION_APPROVAL_REQUIRED,
      'Deducted refund approval permission is required'
    );
  }
};

module.exports = { assertCanApproveDeductedRefund };
