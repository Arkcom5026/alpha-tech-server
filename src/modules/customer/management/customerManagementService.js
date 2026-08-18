const repository = require('./customerManagementRepository');
const {
  projectQuotationWorkflowPolicy,
} = require('../policies/customerQuotationWorkflowPolicy');

const allowedRoles = new Set(['SUPERADMIN', 'ADMIN', 'EMPLOYEE']);

function normalizeContext(user = {}) {
  return {
    role: String(user.role || ''),
    branchId: Number(user.branchId),
  };
}

function presentCustomer(customer, financial = null) {
  const subdistrictCode = customer.subdistrict?.code || customer.subdistrictCode || null;
  const districtCode = customer.subdistrict?.districtCode || customer.subdistrict?.district?.code || null;
  const provinceCode = customer.subdistrict?.district?.provinceCode || customer.subdistrict?.district?.province?.code || null;
  return {
    id: customer.id,
    userId: customer.userId,
    branchId: customer.branchId,
    name: customer.name || '',
    companyName: customer.companyName || '',
    departmentName: customer.departmentName || '',
    financialMembers: customer.financialMembers || [],
    phone: customer.user?.loginId || '',
    email: customer.user?.email || '',
    taxId: customer.taxId || '',
    type: customer.type || 'INDIVIDUAL',
    ...projectQuotationWorkflowPolicy(customer),
    addressDetail: customer.addressDetail || '',
    provinceCode,
    districtCode,
    subdistrictCode,
    postcode: customer.subdistrict?.postcode || null,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    creditLimit: customer.creditLimit,
    creditBalance: customer.creditBalance,
    depositBalance: financial?.financialGroupStatus === 'STANDALONE'
      ? financial.groupAvailableCustomerMoney
      : customer.depositBalance_v2,
    outstandingDebt: financial?.memberOutstandingDebt ?? customer.outstandingDebt_v2,
    financialGroupStatus: financial?.financialGroupStatus || 'STANDALONE',
    financialOwnerCustomerId: financial?.financialOwnerCustomerId ?? customer.financialOwnerCustomerId ?? null,
    financialOwner: financial?.financialOwner || customer.financialOwner || null,
    memberOutstandingDebt: financial?.memberOutstandingDebt ?? Number(customer.outstandingDebt_v2 || 0),
    groupOutstandingDebt: financial?.groupOutstandingDebt ?? Number(customer.outstandingDebt_v2 || 0),
    groupAvailableCustomerMoney: financial?.groupAvailableCustomerMoney ?? Number(customer.depositBalance_v2 || 0),
    groupMemberCount: financial?.groupMemberCount || 1,
    ownershipStatus: customer.branchId === null ? 'UNASSIGNED' : 'STORE',
  };
}

function authorizeStoreUser(user) {
  const context = normalizeContext(user);
  if (!allowedRoles.has(context.role)) {
    return { error: { status: 403, body: { code: 'CUSTOMER_MANAGEMENT_FORBIDDEN', message: 'Forbidden' } } };
  }
  if (!Number.isInteger(context.branchId) || context.branchId <= 0) {
    return { error: { status: 403, body: { code: 'STORE_AUTHORITY_REQUIRED', message: 'ต้องมีอำนาจของร้านปัจจุบัน' } } };
  }
  return { context };
}

async function listCustomers({ user, scope, query, limit }) {
  const authorized = authorizeStoreUser(user);
  if (authorized.error) return authorized.error;

  const normalizedScope = String(scope || 'STORE').toUpperCase();
  if (!['STORE', 'UNASSIGNED'].includes(normalizedScope)) {
    return { status: 400, body: { code: 'INVALID_CUSTOMER_SCOPE', message: 'ขอบเขตรายการลูกค้าไม่ถูกต้อง' } };
  }

  const customers = await repository.listCustomers({
    branchId: authorized.context.branchId,
    scope: normalizedScope,
    query,
    limit,
  });
  const projection = normalizedScope === 'STORE'
    ? await repository.getFinancialProjection({ branchId: authorized.context.branchId, customers })
    : new Map();

  return {
    status: 200,
    body: {
      scope: normalizedScope,
      count: customers.length,
      results: customers.map((customer) => presentCustomer(customer, projection.get(customer.id))),
    },
  };
}

async function getCustomerDetail({ user, customerProfileId }) {
  const authorized = authorizeStoreUser(user);
  if (authorized.error) return authorized.error;

  const id = Number(customerProfileId);
  if (!Number.isInteger(id) || id <= 0) {
    return { status: 400, body: { code: 'INVALID_CUSTOMER_ID', message: 'รหัสลูกค้าไม่ถูกต้อง' } };
  }

  const customer = await repository.findCustomerDetail({ customerProfileId: id });
  if (!customer) {
    return { status: 404, body: { code: 'CUSTOMER_NOT_FOUND', message: 'ไม่พบข้อมูลลูกค้า' } };
  }
  if (customer.branchId !== authorized.context.branchId) {
    return { status: 403, body: { code: 'CUSTOMER_DETAIL_BRANCH_FORBIDDEN', message: 'ไม่สามารถเปิดข้อมูลลูกค้าของร้านอื่นได้' } };
  }

  const projection = await repository.getFinancialProjection({
    branchId: authorized.context.branchId,
    customers: [customer],
  });

  return { status: 200, body: { customer: presentCustomer(customer, projection.get(customer.id)) } };
}

async function claimLegacyCustomer({ user, customerProfileId }) {
  const authorized = authorizeStoreUser(user);
  if (authorized.error) return authorized.error;

  const id = Number(customerProfileId);
  if (!Number.isInteger(id) || id <= 0) {
    return { status: 400, body: { code: 'INVALID_CUSTOMER_ID', message: 'รหัสลูกค้าไม่ถูกต้อง' } };
  }

  const result = await repository.claimLegacyCustomer({ customerProfileId: id, branchId: authorized.context.branchId });
  if (result.outcome === 'NOT_FOUND') return { status: 404, body: { code: 'CUSTOMER_NOT_FOUND', message: 'ไม่พบข้อมูลลูกค้า' } };
  if (result.outcome === 'ALREADY_ASSIGNED' || result.outcome === 'CLAIM_CONFLICT') return { status: 409, body: { code: 'CUSTOMER_ALREADY_ASSIGNED', message: 'ลูกค้ารายนี้ถูกร้านอื่นรับไปแล้ว กรุณารีเฟรชรายการ' } };
  if (result.outcome === 'STORE_PROFILE_EXISTS') return { status: 409, body: { code: 'STORE_CUSTOMER_ALREADY_EXISTS', message: 'ผู้ใช้นี้เป็นลูกค้าของร้านอยู่แล้ว', existingCustomerProfileId: result.customerProfileId } };
  return { status: 200, body: { message: 'รับลูกค้าเข้าร้านเรียบร้อยแล้ว', customer: presentCustomer(result.customer) } };
}

module.exports = { presentCustomer, listCustomers, getCustomerDetail, claimLegacyCustomer };
