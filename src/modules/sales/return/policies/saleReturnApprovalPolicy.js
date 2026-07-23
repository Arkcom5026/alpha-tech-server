const { SaleReturnError } = require('../contracts/saleReturnError');
const { SaleReturnFailureCode } = require('../contracts/saleReturnFailureCode');

const DEDUCTED_REFUND_ROLES = new Set(['OWNER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']);

const assertCanApproveDeductedRefund = ({ deductedAmount, actorRole, employeeRole }) => {
  if (!deductedAmount.gt(0)) return;
  const roles = [actorRole, employeeRole].map((role) => String(role || '').toUpperCase());
  if (!roles.some((role) => DEDUCTED_REFUND_ROLES.has(role))) {
    throw new SaleReturnError(
      403,
      SaleReturnFailureCode.DEDUCTION_APPROVAL_REQUIRED,
      'OWNER, MANAGER or ADMIN approval is required for a deducted refund'
    );
  }
};

module.exports = { assertCanApproveDeductedRefund, DEDUCTED_REFUND_ROLES };
