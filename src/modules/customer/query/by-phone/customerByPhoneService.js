const customerByPhoneRepository = require('./customerByPhoneRepository');
const {
  normalizePhone,
  isValidPhone,
  buildCustomerAddress,
} = require('../../../shared/customerControllerSupport');

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

async function getCustomerByPhone({ branchId, rawPhone }) {
  if (!branchId) {
    return { status: 401, body: { message: 'Unauthorized (missing branchId)' } };
  }

  const phone = normalizePhone(rawPhone);
  if (!isValidPhone(phone)) {
    return { status: 400, body: { message: 'รูปแบบเบอร์โทรไม่ถูกต้อง' } };
  }

  const customer = await customerByPhoneRepository.findBranchCustomerByPhone({
    branchId,
    phone,
  });

  if (!customer) {
    return { status: 404, body: { message: 'ไม่พบลูกค้า' } };
  }

  return { status: 200, body: presentCustomer(customer) };
}

module.exports = {
  getCustomerByPhone,
  presentCustomer,
};
