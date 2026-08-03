const saleCustomerAccessRepository = require('../repositories/saleCustomerAccessRepository');
const {
  SaleCompletionError,
} = require('../contracts/saleCompletionError');
const {
  verifyCustomerFirstAssociationToken,
} = require('../../../customer/policies/customerFirstAssociationTokenPolicy');

class SaleCustomerAccessService {
  constructor(repository = saleCustomerAccessRepository) {
    this.repository = repository;
  }

  async assertAccessible({
    customerId,
    branchId,
    employeeId,
    customerFirstAssociationToken,
  }) {
    if (!customerId) return null;

    const customer = await this.repository.findAccessibleCustomer({
      customerId: Number(customerId),
      branchId: Number(branchId),
    });
    if (customer) return customer;

    const firstAssociationAllowed = customerFirstAssociationToken &&
      verifyCustomerFirstAssociationToken(customerFirstAssociationToken, {
        customerId,
        branchId,
        employeeId,
      });

    if (firstAssociationAllowed) {
      return this.repository.findCustomerById(Number(customerId));
    }

    throw new SaleCompletionError(
      404,
      'SALE_CUSTOMER_NOT_ACCESSIBLE_IN_BRANCH',
      'Customer was not found in the authenticated store'
    );
  }
}

module.exports = new SaleCustomerAccessService();
module.exports.SaleCustomerAccessService = SaleCustomerAccessService;
