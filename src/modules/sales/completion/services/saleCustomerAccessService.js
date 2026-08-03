const saleCustomerAccessRepository = require('../repositories/saleCustomerAccessRepository');
const {
  SaleCompletionError,
} = require('../contracts/saleCompletionError');

class SaleCustomerAccessService {
  constructor(repository = saleCustomerAccessRepository) {
    this.repository = repository;
  }

  async assertAccessible({ customerId, branchId }) {
    if (!customerId) return null;

    const customer = await this.repository.findAccessibleCustomer({
      customerId: Number(customerId),
      branchId: Number(branchId),
    });

    if (!customer) {
      throw new SaleCompletionError(
        404,
        'SALE_CUSTOMER_NOT_ACCESSIBLE_IN_BRANCH',
        'Customer was not found in the authenticated store'
      );
    }

    return customer;
  }
}

module.exports = new SaleCustomerAccessService();
module.exports.SaleCustomerAccessService = SaleCustomerAccessService;
