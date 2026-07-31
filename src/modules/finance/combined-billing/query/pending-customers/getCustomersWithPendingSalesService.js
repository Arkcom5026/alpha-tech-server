const {
  GetCustomersWithPendingSalesRepository,
} = require('./getCustomersWithPendingSalesRepository');

const toPositiveInt = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
};

const normalizeKeyword = (value) => (value || '').toString().trim();

const mapPendingCustomers = (sales) => {
  const customerMap = new Map();

  for (const sale of sales) {
    const customer = sale.customer;
    const customerId = sale.customerId;

    if (!customerMap.has(customerId)) {
      customerMap.set(customerId, {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        customerType: customer.customerType,
        companyName: customer.companyName,
        sales: [],
      });
    }

    customerMap.get(customerId).sales.push({
      id: sale.id,
      code: sale.code,
      soldAt: sale.soldAt,
      totalBeforeDiscount: sale.totalBeforeDiscount,
      totalDiscount: sale.totalDiscount,
      totalAfterDiscount: sale.totalAfterDiscount,
    });
  }

  return Array.from(customerMap.values());
};

class GetCustomersWithPendingSalesService {
  constructor(repository = new GetCustomersWithPendingSalesRepository()) {
    this.repository = repository;
  }

  async execute({ branchId, keyword }) {
    const normalizedBranchId = toPositiveInt(branchId);
    if (!normalizedBranchId) {
      const error = new Error('unauthorized');
      error.statusCode = 401;
      throw error;
    }

    const sales = await this.repository.findPendingSales({
      branchId: normalizedBranchId,
      keyword: normalizeKeyword(keyword),
    });

    return mapPendingCustomers(sales);
  }
}

module.exports = {
  GetCustomersWithPendingSalesService,
  mapPendingCustomers,
  normalizeKeyword,
};
