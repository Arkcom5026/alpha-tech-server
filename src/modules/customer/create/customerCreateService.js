const bcrypt = require('bcryptjs');
const repository = require('./customerCreateRepository');
const {
  normalizePhone,
  isValidPhone,
  buildCustomerAddress,
} = require('../shared/customerControllerSupport');
const {
  projectQuotationWorkflowPolicy,
} = require('../policies/customerQuotationWorkflowPolicy');
const {
  issueCustomerFirstAssociationToken,
} = require('../policies/customerFirstAssociationTokenPolicy');

function presentCustomer(customer, { includeCredit = true, firstAssociationToken = null } = {}) {
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
    ...projectQuotationWorkflowPolicy(customer),
    companyName: customer.companyName,
    departmentName: customer.departmentName,
    financialOwnerCustomerId: customer.financialOwnerCustomerId,
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
    ...(firstAssociationToken ? { firstAssociationToken } : {}),
  };
}

function buildError(statusCode, payload) {
  const error = new Error(payload.message || payload.error || 'Customer create failed');
  error.statusCode = statusCode;
  error.payload = payload;
  return error;
}

async function createCustomer(input = {}, actor = {}) {
  const branchId = Number(actor.branchId);
  const employeeId = Number(actor.employeeId);
  if (!Number.isInteger(branchId) || branchId <= 0 || !Number.isInteger(employeeId) || employeeId <= 0) {
    throw buildError(401, { code: 'UNAUTHORIZED', message: 'Authenticated store and employee are required' });
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
    postalCode,
    postcode,
  } = input;
  if (![undefined, null, true, false].includes(quotationWorkflowOverride)) {
    throw buildError(400, { code: 'INVALID_QUOTATION_WORKFLOW_OVERRIDE', message: 'นโยบายใบเสนอราคาไม่ถูกต้อง' });
  }
  const normalizedPhone = normalizePhone(phone);

  if (!name || !isValidPhone(normalizedPhone)) {
    throw buildError(400, { error: 'ต้องระบุชื่อและเบอร์โทร 9 หรือ 10 หลัก' });
  }

  const existingUser = await repository.findUserByPhone(normalizedPhone);

  if (existingUser && existingUser.role !== 'CUSTOMER') {
    throw buildError(409, { message: 'เบอร์นี้ถูกใช้ในบัญชีประเภทอื่นแล้ว' });
  }
  if (existingUser && existingUser.loginType && existingUser.loginType !== 'PHONE') {
    throw buildError(409, { message: 'เบอร์นี้ถูกใช้กับวิธีล็อกอินอื่นแล้ว' });
  }

  if (existingUser) {
    const existingProfile = await repository.findCustomerByUserAndBranch({
      userId: existingUser.id,
      branchId,
    });
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
    branchId,
    customer: {
      name,
      type,
      quotationWorkflowOverride: quotationWorkflowOverride ?? null,
      companyName,
      departmentName: type === 'INDIVIDUAL' ? null : (departmentName || null),
      financialOwnerCustomerId: type === 'INDIVIDUAL' ? null : (financialOwnerCustomerId || null),
      taxId,
      subdistrictCode,
      addressDetail,
    },
  });

  const firstAssociationToken = issueCustomerFirstAssociationToken({
    customerId: result.id,
    branchId,
    employeeId,
  });

  return {
    statusCode: 201,
    body: presentCustomer(result, { firstAssociationToken }),
  };
}

module.exports = { createCustomer };
