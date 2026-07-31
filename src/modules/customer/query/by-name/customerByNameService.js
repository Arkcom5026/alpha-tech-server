const customerByNameRepository = require('./customerByNameRepository');
const { buildCustomerAddress } = require('../../shared/customerControllerSupport');

const presentCustomer = (customer) => {
  const subdistrictCode = customer.subdistrict?.code || null;
  const districtCode =
    customer.subdistrict?.districtCode || customer.subdistrict?.district?.code || null;
  const provinceCode =
    customer.subdistrict?.district?.provinceCode ||
    customer.subdistrict?.district?.province?.code ||
    null;

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.user?.loginId || null,
    provinceCode,
    districtCode,
    subdistrictCode,
    addressDetail: customer.addressDetail || null,
    email: '',
    type: customer.type,
    companyName: customer.companyName,
    taxId: customer.taxId,
    postcode: customer.subdistrict?.postcode || null,
    creditLimit: customer.creditLimit,
    creditBalance: customer.creditBalance,
    customerAddress: buildCustomerAddress(customer),
  };
};

async function getCustomerByName({ branchId, rawQuery }) {
  if (!branchId) {
    return { status: 401, body: { message: 'Unauthorized (missing branchId)' } };
  }

  const query = String(rawQuery || '').trim();
  if (!query) {
    return { status: 200, body: [] };
  }

  const customers = await customerByNameRepository.findBranchCustomersByName({
    branchId,
    query,
  });

  return { status: 200, body: customers.map(presentCustomer) };
}

module.exports = {
  getCustomerByName,
  presentCustomer,
};
