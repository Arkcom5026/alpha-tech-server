const bcrypt = require('bcryptjs');
const repository = require('./customerCreateRepository');
const {
  normalizePhone,
  isValidPhone,
  buildCustomerAddress,
} = require('../shared/customerControllerSupport');

function presentCustomer(customer, { includeCredit = true } = {}) {
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
    email: '',
    type: customer.type,
    companyName: customer.companyName,
    taxId: customer.taxId,
    provinceCode,
    districtCode,
    subdistrictCode,
    addressDetail: customer.addressDetail || null,
    postcode: customer.subdistrict?.postcode || null,
    customerAddress: buildCustomerAddress(customer),
    ...(includeCredit
      ? {
          creditLimit: customer.creditLimit,
          creditBalance: customer.creditBalance,
        }
      : {}),
  };
}

function buildError(statusCode, payload) {
  const error = new Error(payload.message || payload.error || 'Customer create failed');
  error.statusCode = statusCode;
  error.payload = payload;
  return error;
}

async function createCustomer(input = {}) {
  const {
    name,
    phone,
    type,
    companyName,
    taxId,
    subdistrictCode,
    addressDetail,
    postalCode,
    postcode,
  } = input;
  const normalizedPhone = normalizePhone(phone);

  if (!name || !isValidPhone(normalizedPhone)) {
    throw buildError(400, { error: 'ต้องระบุชื่อและเบอร์โทร (10 หลัก)' });
  }

  const existingUser = await repository.findUserByPhone(normalizedPhone);

  if (existingUser && existingUser.role !== 'CUSTOMER') {
    throw buildError(409, { message: 'เบอร์นี้ถูกใช้ในบัญชีประเภทอื่นแล้ว' });
  }
  if (existingUser && existingUser.loginType && existingUser.loginType !== 'PHONE') {
    throw buildError(409, { message: 'เบอร์นี้ถูกใช้กับวิธีล็อกอินอื่นแล้ว' });
  }

  if (existingUser) {
    const existingProfile = await repository.findCustomerByUserId(existingUser.id);
    if (existingProfile) {
      return { statusCode: 200, body: presentCustomer(existingProfile) };
    }
  }

  const clientPostcode = postalCode ?? postcode;
  if (typeof subdistrictCode === 'string' && subdistrictCode) {
    const subdistrict = await repository.findSubdistrictByCode(subdistrictCode);
    if (!subdistrict) {
      throw buildError(400, { message: 'รหัสตำบลไม่ถูกต้อง' });
    }
    if (clientPostcode && String(subdistrict.postcode) !== String(clientPostcode)) {
      throw buildError(400, {
        message: 'รหัสไปรษณีย์ไม่ตรงกับตำบลที่เลือก',
        expectedPostcode: subdistrict.postcode,
      });
    }
  }

  const hashedPassword = await bcrypt.hash(normalizedPhone.slice(-4), 10);
  const result = await repository.createCustomerProfile({
    existingUser,
    normalizedPhone,
    hashedPassword,
    customer: {
      name,
      type,
      companyName,
      taxId,
      subdistrictCode,
      addressDetail,
    },
  });

  return { statusCode: 201, body: presentCustomer(result) };
}

module.exports = { createCustomer };
