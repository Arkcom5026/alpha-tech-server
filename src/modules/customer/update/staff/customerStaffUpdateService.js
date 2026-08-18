const {
  toInt,
  normalizePhone,
  isValidPhone,
  buildCustomerAddress,
} = require('../../shared/customerControllerSupport');
const {
  projectQuotationWorkflowPolicy,
} = require('../../policies/customerQuotationWorkflowPolicy');
const repository = require('./customerStaffUpdateRepository');

const allowedRoles = new Set(['SUPERADMIN', 'ADMIN', 'EMPLOYEE']);
const allowedTypes = new Set(['INDIVIDUAL', 'ORGANIZATION', 'GOVERNMENT']);

function serviceError(status, body, code) {
  const error = new Error(code || body?.message || 'CUSTOMER_STAFF_UPDATE_FAILED');
  error.status = status;
  error.body = body;
  return error;
}

function validateCustomerType(type) {
  return typeof type === 'undefined' || allowedTypes.has(type);
}

function validateQuotationWorkflowOverride(value) {
  return typeof value === 'undefined' || value === null || value === true || value === false;
}

function presentCustomer(customer) {
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
    ...projectQuotationWorkflowPolicy(customer),
    companyName: customer.companyName,
    departmentName: customer.departmentName,
    financialOwnerCustomerId: customer.financialOwnerCustomerId,
    taxId: customer.taxId,
    provinceCode,
    districtCode,
    subdistrictCode,
    addressDetail: customer.addressDetail,
    postcode: customer.subdistrict?.postcode || null,
    customerAddress: buildCustomerAddress(customer),
    phone: customer.user?.loginId || null,
    email: customer.user?.email || '',
  };
}

async function updateCustomerStaff({ userContext = {}, customerId, body = {} }) {
  const role = userContext.role || '';
  const branchId = toInt(userContext.branchId);

  if (!userContext.id) {
    throw serviceError(401, { message: 'Unauthorized' }, 'UNAUTHORIZED');
  }
  if (!allowedRoles.has(role)) {
    throw serviceError(403, { message: 'Forbidden' }, 'FORBIDDEN');
  }
  if (role !== 'SUPERADMIN' && !branchId) {
    throw serviceError(
      403,
      { message: 'ต้องมีอำนาจของร้านปัจจุบันเพื่อแก้ไขข้อมูลลูกค้า' },
      'STORE_AUTHORITY_REQUIRED'
    );
  }

  const id = toInt(customerId);
  if (!id) {
    throw serviceError(400, { message: 'รหัสลูกค้าไม่ถูกต้อง' }, 'INVALID_CUSTOMER_ID');
  }

  const {
    name,
    phone,
    type,
    quotationWorkflowOverride,
    companyName,
    departmentName,
    financialOwnerCustomerId,
    taxId,
    subdistrictCode,
    addressDetail,
  } = body;
  if (!validateCustomerType(type)) {
    throw serviceError(400, { message: 'ประเภทลูกค้าไม่ถูกต้อง' }, 'INVALID_CUSTOMER_TYPE');
  }
  if (!validateQuotationWorkflowOverride(quotationWorkflowOverride)) {
    throw serviceError(400, { message: 'นโยบายใบเสนอราคาไม่ถูกต้อง' }, 'INVALID_QUOTATION_WORKFLOW_OVERRIDE');
  }

  const existing = await repository.findCustomerById(id);
  if (!existing) {
    throw serviceError(404, { message: 'ไม่พบข้อมูลลูกค้า' }, 'CUSTOMER_NOT_FOUND');
  }

  if (role !== 'SUPERADMIN') {
    if (!existing.branchId) {
      throw serviceError(
        409,
        { message: 'ข้อมูลลูกค้านี้ยังไม่มีร้านเจ้าของ ต้องผ่านกระบวนการกำหนดร้านก่อนแก้ไข' },
        'CUSTOMER_BRANCH_OWNERSHIP_REQUIRED'
      );
    }
    if (existing.branchId !== branchId) {
      throw serviceError(
        403,
        { message: 'คุณไม่มีสิทธิ์แก้ไขลูกค้าของร้านอื่น' },
        'CROSS_BRANCH_CUSTOMER_UPDATE_FORBIDDEN'
      );
    }
  }

  const sanitize = (value) => (typeof value === 'string' ? value.trim() : value);
  const profileData = Object.fromEntries(
    Object.entries({
      name: sanitize(name),
      type,
      quotationWorkflowOverride,
      companyName: sanitize(companyName),
      departmentName: sanitize(departmentName),
      financialOwnerCustomerId,
      taxId: sanitize(taxId),
      addressDetail: sanitize(addressDetail),
    }).filter(([, value]) => value !== undefined)
  );

  const clientPostcode =
    body.postalCode ?? body.postcode
      ? String(body.postalCode ?? body.postcode)
      : undefined;

  if (typeof subdistrictCode === 'string' && subdistrictCode) {
    const subdistrict = await repository.findSubdistrictPostcode(subdistrictCode);
    if (!subdistrict) {
      throw serviceError(400, { message: 'รหัสตำบลไม่ถูกต้อง' }, 'INVALID_SUBDISTRICT');
    }
    if (clientPostcode && String(subdistrict.postcode) !== clientPostcode) {
      throw serviceError(
        400,
        {
          message: 'รหัสไปรษณีย์ไม่ตรงกับตำบลที่เลือก',
          expectedPostcode: subdistrict.postcode,
        },
        'POSTCODE_MISMATCH'
      );
    }
  }

  let normalizedPhone;
  if (phone) {
    normalizedPhone = normalizePhone(phone);
    if (!isValidPhone(normalizedPhone)) {
      throw serviceError(400, { message: 'รูปแบบเบอร์โทรไม่ถูกต้อง' }, 'INVALID_PHONE');
    }
  }

  try {
    const updated = await repository.updateCustomer({
      id,
      userId: existing.userId,
      profileData,
      subdistrictCode,
      phone: normalizedPhone,
    });
    return presentCustomer(updated);
  } catch (error) {
    if (error?.code === 'P2002') {
      throw serviceError(409, { message: 'ข้อมูลซ้ำกัน' }, 'DUPLICATE_CUSTOMER_DATA');
    }
    throw error;
  }
}

module.exports = {
  updateCustomerStaff,
};
