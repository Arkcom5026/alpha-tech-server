const customerSelfRepository = require('./customerSelfRepository');
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
    companyName: customer.companyName,
    taxId: customer.taxId,
    postcode: customer.subdistrict?.postcode || null,
    customerAddress: buildCustomerAddress(customer),
  };
};

async function getCustomerSelf({ userId, role }) {
  if (role !== 'CUSTOMER') {
    return { status: 403, body: { message: 'Forbidden' } };
  }

  const customer = await customerSelfRepository.findCustomerByUserId({ userId });

  if (!customer) {
    return { status: 404, body: { message: 'ไม่พบข้อมูลลูกค้า' } };
  }

  return { status: 200, body: presentCustomer(customer) };
}

module.exports = {
  getCustomerSelf,
  presentCustomer,
};
