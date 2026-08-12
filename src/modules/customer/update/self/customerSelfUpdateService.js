const {
  omitUndefined,
  normalizePhone,
  isValidPhone,
  buildCustomerAddress,
} = require('../../shared/customerControllerSupport');
const repository = require('./customerSelfUpdateRepository');

const VALID_CUSTOMER_TYPES = new Set(['INDIVIDUAL', 'ORGANIZATION', 'GOVERNMENT']);

const presentUpdatedCustomer = (customer) => {
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
    type: customer.type,
    companyName: customer.companyName,
    departmentName: customer.departmentName,
    financialOwnerCustomerId: customer.financialOwnerCustomerId,
    taxId: customer.taxId,
    provinceCode,
    districtCode,
    subdistrictCode,
    addressDetail: customer.addressDetail,
    customerAddress: buildCustomerAddress(customer),
    phone: customer.user?.loginId || null,
    email: '',
  };
};

const updateCustomerSelf = async ({ user, body = {} }) => {
  if (!user || user.role !== 'CUSTOMER') {
    return { status: 403, body: { message: 'Forbidden' } };
  }

  const customerProfileId = user.customerProfileId || user.profileId;
  if (!customerProfileId) {
    return {
      status: 409,
      body: {
        code: 'ACTIVE_CUSTOMER_PROFILE_REQUIRED',
        message: 'กรุณาเลือกร้านก่อนแก้ไขข้อมูลลูกค้า',
      },
    };
  }

  const { name, phone, type, companyName, taxId, subdistrictCode, addressDetail } = body;

  if (typeof type !== 'undefined' && !VALID_CUSTOMER_TYPES.has(type)) {
    return { status: 400, body: { message: 'ประเภทลูกค้าไม่ถูกต้อง' } };
  }

  const clientPostcode =
    body.postalCode ?? body.postcode
      ? String(body.postalCode ?? body.postcode)
      : undefined;

  if (typeof subdistrictCode === 'string' && subdistrictCode) {
    const subdistrict = await repository.findSubdistrictPostcode(subdistrictCode);
    if (!subdistrict) {
      return { status: 400, body: { message: 'รหัสตำบลไม่ถูกต้อง' } };
    }
    if (clientPostcode && String(subdistrict.postcode) !== clientPostcode) {
      return {
        status: 400,
        body: {
          message: 'รหัสไปรษณีย์ไม่ตรงกับตำบลที่เลือก',
          expectedPostcode: subdistrict.postcode,
        },
      };
    }
  }

  let normalizedPhone;
  if (phone) {
    normalizedPhone = normalizePhone(phone);
    if (!isValidPhone(normalizedPhone)) {
      return { status: 400, body: { message: 'รูปแบบเบอร์โทรไม่ถูกต้อง' } };
    }
  }

  const profileData = omitUndefined({
    name,
    type,
    companyName,
    taxId,
    addressDetail,
  });

  const existing = await repository.findActiveCustomerProfile({
    customerProfileId,
    userId: user.id,
  });

  if (!existing) {
    return {
      status: 404,
      body: {
        code: 'CUSTOMER_PROFILE_NOT_FOUND',
        message: 'ไม่พบข้อมูลลูกค้าสำหรับร้านที่เลือก',
      },
    };
  }

  if (existing.financialOwnerCustomerId) {
    delete profileData.type;
    delete profileData.companyName;
    delete profileData.taxId;
  }

  const updated = await repository.updateCustomerSelf({
    userId: user.id,
    existing,
    profileData,
    subdistrictCode,
    phone: normalizedPhone,
  });
  const full = await repository.findCustomerDetailById({
    id: updated.id,
    userId: user.id,
  });

  return { status: 200, body: presentUpdatedCustomer(full) };
};

module.exports = { updateCustomerSelf };
