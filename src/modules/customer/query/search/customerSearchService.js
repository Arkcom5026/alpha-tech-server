const repository = require('./customerSearchRepository');
const { buildCustomerAddress } = require('../../shared/customerControllerSupport');

const normalizeQuery = (value) => String(value || '').trim();
const compactDigits = (value) => value.replace(/\D/g, '');
const isPhoneLikeQuery = (value) => /^[\d\s()+-]+$/.test(value);

const presentCustomer = (customer) => ({
  id: customer.id,
  name: customer.name || '',
  phone: customer.user?.loginId || '',
  email: customer.user?.email || '',
  type: customer.type || 'INDIVIDUAL',
  companyName: customer.companyName || '',
  departmentName: customer.departmentName || '',
  financialOwnerCustomerId: customer.financialOwnerCustomerId || null,
  taxId: customer.taxId || '',
  creditLimit: customer.creditLimit,
  creditBalance: customer.creditBalance,
  provinceCode:
    customer.subdistrict?.district?.provinceCode ||
    customer.subdistrict?.district?.province?.code ||
    null,
  districtCode:
    customer.subdistrict?.districtCode ||
    customer.subdistrict?.district?.code ||
    null,
  subdistrictCode: customer.subdistrict?.code || null,
  postcode: customer.subdistrict?.postcode || null,
  addressDetail: customer.addressDetail || null,
  customerAddress: buildCustomerAddress(customer),
});

async function searchCustomers({ branchId, rawQuery }) {
  const normalizedBranchId = Number(branchId);
  if (!Number.isInteger(normalizedBranchId) || normalizedBranchId <= 0) {
    return { status: 401, body: { code: 'CUSTOMER_SEARCH_UNAUTHORIZED', message: 'Unauthorized' } };
  }

  const query = normalizeQuery(rawQuery);
  if (!query) {
    return {
      status: 400,
      body: { code: 'CUSTOMER_SEARCH_QUERY_REQUIRED', message: 'กรุณาระบุคำค้นหาลูกค้า' },
    };
  }

  const phoneLike = isPhoneLikeQuery(query);
  const effectiveQuery = phoneLike ? compactDigits(query) : query;
  const minimum = phoneLike ? 4 : 2;
  if (effectiveQuery.length < minimum) {
    return {
      status: 400,
      body: {
        code: 'CUSTOMER_SEARCH_QUERY_TOO_SHORT',
        message: phoneLike
          ? 'กรุณากรอกตัวเลขอย่างน้อย 4 หลัก'
          : 'กรุณากรอกคำค้นหาอย่างน้อย 2 ตัวอักษร',
      },
    };
  }

  const customers = await repository.searchBranchCustomers({
    branchId: normalizedBranchId,
    query: effectiveQuery,
    limit: 20,
  });

  return {
    status: 200,
    body: {
      query,
      count: customers.length,
      results: customers.map(presentCustomer),
    },
  };
}

module.exports = { searchCustomers, presentCustomer, isPhoneLikeQuery };
