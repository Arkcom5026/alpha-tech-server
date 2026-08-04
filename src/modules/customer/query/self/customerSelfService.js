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

async function getCustomerSelf({ userId, role, customerProfileId }) {
  if (role !== 'CUSTOMER') {
    return { status: 403, body: { message: 'Forbidden' } };
  }

  if (!customerProfileId) {
    return {
      status: 409,
      body: {
        code: 'ACTIVE_CUSTOMER_PROFILE_REQUIRED',
        message: 'กรุณาเลือกร้านก่อนเปิดข้อมูลลูกค้า',
      },
    };
  }

  const customer = await customerSelfRepository.findActiveCustomerProfile({
    customerProfileId,
    userId,
  });

  if (!customer) {
    return {
      status: 404,
      body: {
        code: 'CUSTOMER_PROFILE_NOT_FOUND',
        message: 'ไม่พบข้อมูลลูกค้าสำหรับร้านที่เลือก',
      },
    };
  }

  return { status: 200, body: presentCustomer(customer) };
}

module.exports = {
  getCustomerSelf,
  presentCustomer,
};
