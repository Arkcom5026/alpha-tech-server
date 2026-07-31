const { Prisma } = require('../../../../../lib/prisma');
const repository = require('./customerDepositRuntimeRepository');

const NORMALIZE_DECIMAL_TO_NUMBER = process.env.NORMALIZE_DECIMAL_TO_NUMBER !== '0';

const D = (value) => new Prisma.Decimal(typeof value === 'string' ? value : Number(value));
const toNum = (value) => (
  value && typeof value === 'object' && 'toNumber' in value
    ? value.toNumber()
    : Number(value)
);
const isMoneyLike = (value) => (
  (typeof value === 'number' && !Number.isNaN(value))
  || (typeof value === 'string' && /^\d+(\.\d{1,2})?$/.test(value))
);

const normalizeDeposit = (deposit) => {
  if (!NORMALIZE_DECIMAL_TO_NUMBER || !deposit) return deposit;
  const output = { ...deposit };
  for (const key of ['cashAmount', 'transferAmount', 'cardAmount', 'usedAmount', 'totalAmount']) {
    if (key in output && output[key] != null) output[key] = toNum(output[key]);
  }
  const total = output.totalAmount != null ? Number(output.totalAmount) : 0;
  const used = output.usedAmount != null ? Number(output.usedAmount) : 0;
  output.remainingAmount = Number((total - used).toFixed(2));
  return output;
};

const normalizeCustomerMoney = (customer) => {
  if (!NORMALIZE_DECIMAL_TO_NUMBER || !customer) return customer;
  const output = { ...customer };
  for (const key of ['creditLimit', 'creditBalance']) {
    if (key in output && output[key] != null) output[key] = toNum(output[key]);
  }
  return output;
};

const normalizePhone = (raw = '') => String(raw).replace(/\D/g, '').replace(/^66/, '0').slice(-10);
const isValidPhone = (value = '') => /^\d{10}$/.test(value);

const buildCustomerAddress = (profile) => {
  const parts = [];
  if (profile?.addressDetail) parts.push(profile.addressDetail);
  const subdistrict = profile?.subdistrict;
  const district = subdistrict?.district;
  const province = district?.province;
  if (subdistrict?.nameTh) parts.push(subdistrict.nameTh);
  if (district?.nameTh) parts.push(district.nameTh);
  if (province?.nameTh) parts.push(province.nameTh);
  if (subdistrict?.postcode) parts.push(subdistrict.postcode);
  return parts.filter(Boolean).join(' ');
};

const getDepositRemainingDecimal = (deposit) => (
  new Prisma.Decimal(deposit?.totalAmount ?? 0)
    .minus(new Prisma.Decimal(deposit?.usedAmount ?? 0))
);

const sumDeposits = (deposits = []) => deposits.reduce(
  (sum, deposit) => sum.plus(getDepositRemainingDecimal(deposit)),
  new Prisma.Decimal(0)
);

const projectDeposit = (deposit) => {
  const base = NORMALIZE_DECIMAL_TO_NUMBER ? normalizeDeposit(deposit) : deposit;
  return {
    ...base,
    customer: {
      name: deposit?.customer?.name || '',
      phone: deposit?.customer?.user?.loginId || null,
    },
  };
};

const projectCustomerSummary = (customer) => {
  const totalDeposit = sumDeposits(customer?.customerDeposits || []);
  const subdistrictCode = customer.subdistrictCode || null;
  const districtCode = customer.subdistrict?.districtCode
    || customer.subdistrict?.district?.code
    || null;
  const provinceCode = customer.subdistrict?.district?.provinceCode
    || customer.subdistrict?.district?.province?.code
    || null;

  return {
    id: customer.id,
    name: customer.name || '',
    phone: customer.user?.loginId || null,
    email: customer.user?.email || '',
    type: customer.type || '',
    companyName: customer.companyName || '',
    taxId: customer.taxId || '',
    creditLimit: NORMALIZE_DECIMAL_TO_NUMBER
      ? toNum(customer.creditLimit || 0)
      : customer.creditLimit,
    creditBalance: NORMALIZE_DECIMAL_TO_NUMBER
      ? toNum(customer.creditBalance || 0)
      : customer.creditBalance,
    provinceCode,
    districtCode,
    subdistrictCode,
    addressDetail: customer.addressDetail || null,
    customerAddress: buildCustomerAddress(customer),
    totalDeposit: NORMALIZE_DECIMAL_TO_NUMBER ? toNum(totalDeposit) : totalDeposit,
    depositCount: Array.isArray(customer.customerDeposits)
      ? customer.customerDeposits.length
      : 0,
  };
};

const createCustomerDeposit = async ({ body = {}, user = {} }) => {
  const {
    cashAmount = 0,
    transferAmount = 0,
    cardAmount = 0,
    note,
    customerId,
  } = body;
  const employeeId = user.employeeId;
  const branchId = Number(user.branchId);

  if (!customerId || !employeeId || !branchId) {
    return {
      status: 400,
      body: { message: 'ข้อมูลไม่ครบ (customerId/employeeId/branchId)' },
    };
  }

  if (![cashAmount, transferAmount, cardAmount].every(isMoneyLike)) {
    return {
      status: 400,
      body: {
        message: 'รูปแบบจำนวนเงินไม่ถูกต้อง (ต้องเป็นเลข และทศนิยมไม่เกิน 2 ตำแหน่ง)',
      },
    };
  }

  const cash = D(cashAmount);
  const transfer = D(transferAmount);
  const card = D(cardAmount);
  const total = cash.plus(transfer).plus(card);
  if (total.lessThanOrEqualTo(0)) {
    return { status: 400, body: { message: 'ยอดรวมต้องมากกว่า 0' } };
  }

  const deposit = await repository.createDeposit({
    cashAmount: cash,
    transferAmount: transfer,
    cardAmount: card,
    totalAmount: total,
    note,
    customerId,
    createdBy: employeeId,
    branchId,
    status: 'ACTIVE',
  });

  return { status: 201, body: projectDeposit(deposit) };
};

const getAllCustomerDeposits = async ({ branchId }) => {
  const normalizedBranchId = Number(branchId);
  if (!normalizedBranchId) {
    return { status: 401, body: { message: 'unauthorized' } };
  }
  const deposits = await repository.findActiveDepositsByBranch(normalizedBranchId);
  return { status: 200, body: deposits.map(projectDeposit) };
};

const getCustomerDepositById = async ({ id, branchId }) => {
  const normalizedId = Number.parseInt(id, 10);
  if (Number.isNaN(normalizedId)) {
    return { status: 400, body: { message: 'ID ไม่ถูกต้อง' } };
  }
  const normalizedBranchId = Number(branchId);
  if (!normalizedBranchId) {
    return { status: 401, body: { message: 'unauthorized' } };
  }
  const deposit = await repository.findActiveDepositByIdAndBranch({
    id: normalizedId,
    branchId: normalizedBranchId,
  });
  if (!deposit) {
    return { status: 404, body: { message: 'ไม่พบข้อมูลมัดจำ' } };
  }
  return { status: 200, body: projectDeposit(deposit) };
};

const getCustomerAndDepositByPhone = async ({ phone: rawPhone, branchId }) => {
  const normalizedBranchId = Number(branchId);
  if (!normalizedBranchId) {
    return { status: 401, body: { error: 'unauthorized' } };
  }
  const phone = normalizePhone(rawPhone);
  if (!isValidPhone(phone)) {
    return {
      status: 400,
      body: { message: 'กรุณาระบุเบอร์โทรให้ถูกต้อง (10 หลัก)' },
    };
  }

  const customer = await repository.findCustomerByPhone({
    phone,
    branchId: normalizedBranchId,
  });
  if (!customer) {
    return { status: 404, body: { message: 'ไม่พบลูกค้า' } };
  }

  const totalDeposit = sumDeposits(customer.customerDeposits);
  const customerOut = normalizeCustomerMoney({
    id: customer.id,
    name: customer.name,
    phone: customer.user?.loginId || null,
    email: customer.user?.email || '',
    type: customer.type,
    companyName: customer.companyName,
    taxId: customer.taxId,
    creditLimit: customer.creditLimit,
    creditBalance: customer.creditBalance,
    provinceCode: customer.subdistrict?.district?.provinceCode
      || customer.subdistrict?.district?.province?.code
      || null,
    districtCode: customer.subdistrict?.districtCode
      || customer.subdistrict?.district?.code
      || null,
    subdistrictCode: customer.subdistrictCode || null,
    addressDetail: customer.addressDetail || null,
    customerAddress: buildCustomerAddress(customer),
  });

  return {
    status: 200,
    body: {
      customer: customerOut,
      totalDeposit: NORMALIZE_DECIMAL_TO_NUMBER ? toNum(totalDeposit) : totalDeposit,
      deposits: NORMALIZE_DECIMAL_TO_NUMBER
        ? customer.customerDeposits.map(normalizeDeposit)
        : customer.customerDeposits,
    },
  };
};

const getCustomerAndDepositByName = async ({ query, branchId }) => {
  const normalizedBranchId = Number(branchId);
  if (!normalizedBranchId) {
    return { status: 401, body: { error: 'unauthorized' } };
  }
  const q = typeof query === 'string' ? query.trim() : '';
  if (!q) {
    return {
      status: 400,
      body: { error: 'กรุณาระบุคำค้นหาที่ถูกต้อง' },
    };
  }
  const customers = await repository.findCustomersByName({
    query: q,
    branchId: normalizedBranchId,
  });
  if (!customers.length) {
    return { status: 404, body: { error: 'ไม่พบลูกค้า' } };
  }
  return {
    status: 200,
    body: {
      query: q,
      count: customers.length,
      results: customers.map(projectCustomerSummary),
    },
  };
};

const getCustomerAndDepositByCustomerId = async ({ customerId, branchId }) => {
  const normalizedBranchId = Number(branchId);
  if (!normalizedBranchId) {
    return { status: 401, body: { error: 'unauthorized' } };
  }
  const normalizedCustomerId = Number.parseInt(customerId, 10);
  if (Number.isNaN(normalizedCustomerId)) {
    return { status: 400, body: { error: 'customerId ไม่ถูกต้อง' } };
  }
  const customer = await repository.findCustomerById({
    customerId: normalizedCustomerId,
    branchId: normalizedBranchId,
  });
  if (!customer) {
    return { status: 404, body: { error: 'ไม่พบลูกค้า' } };
  }
  return {
    status: 200,
    body: {
      customer: projectCustomerSummary(customer),
      deposits: NORMALIZE_DECIMAL_TO_NUMBER
        ? customer.customerDeposits.map(normalizeDeposit)
        : customer.customerDeposits,
    },
  };
};

const updateCustomerDeposit = async ({ id, body = {}, branchId }) => {
  const normalizedId = Number.parseInt(id, 10);
  if (Number.isNaN(normalizedId)) {
    return { status: 400, body: { message: 'ID ไม่ถูกต้อง' } };
  }
  const normalizedBranchId = Number(branchId);
  if (!normalizedBranchId) {
    return { status: 401, body: { message: 'unauthorized' } };
  }
  const existing = await repository.findActiveDepositByIdAndBranch({
    id: normalizedId,
    branchId: normalizedBranchId,
  });
  if (!existing) {
    return { status: 404, body: { message: 'ไม่พบข้อมูลมัดจำ' } };
  }

  const moneyFields = ['cashAmount', 'transferAmount', 'cardAmount'];
  for (const field of moneyFields) {
    if (body[field] !== undefined && !isMoneyLike(body[field])) {
      return {
        status: 400,
        body: {
          message: 'รูปแบบจำนวนเงินไม่ถูกต้อง (ต้องเป็นเลข และทศนิยมไม่เกิน 2 ตำแหน่ง)',
        },
      };
    }
  }

  const cash = body.cashAmount !== undefined ? D(body.cashAmount) : D(existing.cashAmount);
  const transfer = body.transferAmount !== undefined
    ? D(body.transferAmount)
    : D(existing.transferAmount);
  const card = body.cardAmount !== undefined ? D(body.cardAmount) : D(existing.cardAmount);
  const total = cash.plus(transfer).plus(card);
  if (total.lessThanOrEqualTo(0)) {
    return { status: 400, body: { message: 'ยอดรวมต้องมากกว่า 0' } };
  }
  if (total.lessThan(D(existing.usedAmount || 0))) {
    return {
      status: 400,
      body: { message: 'ยอดรวมใหม่ต้องไม่น้อยกว่ายอดที่ใช้ไปแล้ว' },
    };
  }

  const updated = await repository.updateDepositById({
    id: normalizedId,
    data: {
      cashAmount: cash,
      transferAmount: transfer,
      cardAmount: card,
      totalAmount: total,
      ...(body.note !== undefined ? { note: body.note } : {}),
    },
  });
  return { status: 200, body: projectDeposit(updated) };
};

const deleteCustomerDeposit = async ({ id, branchId }) => {
  const normalizedId = Number.parseInt(id, 10);
  if (Number.isNaN(normalizedId)) {
    return { status: 400, body: { message: 'ID ไม่ถูกต้อง' } };
  }
  const normalizedBranchId = Number(branchId);
  if (!normalizedBranchId) {
    return { status: 401, body: { message: 'unauthorized' } };
  }
  const existing = await repository.findActiveDepositByIdAndBranch({
    id: normalizedId,
    branchId: normalizedBranchId,
  });
  if (!existing) {
    return { status: 404, body: { message: 'ไม่พบข้อมูลมัดจำ' } };
  }
  if (D(existing.usedAmount || 0).greaterThan(0)) {
    return {
      status: 400,
      body: { message: 'ไม่สามารถลบเงินมัดจำที่ถูกใช้ไปแล้ว' },
    };
  }
  await repository.deleteDepositById(normalizedId);
  return { status: 200, body: { message: 'ลบข้อมูลมัดจำสำเร็จ' } };
};

const useCustomerDeposit = async ({ body = {}, user = {} }) => {
  const depositId = Number.parseInt(body.depositId, 10);
  const amount = body.amount;
  const branchId = Number(user.branchId);

  if (Number.isNaN(depositId) || !branchId || !isMoneyLike(amount)) {
    return { status: 400, body: { message: 'ข้อมูลไม่ถูกต้อง' } };
  }
  const amountDecimal = D(amount);
  if (amountDecimal.lessThanOrEqualTo(0)) {
    return { status: 400, body: { message: 'ยอดที่ใช้ต้องมากกว่า 0' } };
  }

  const result = await repository.runTransaction(async (tx) => {
    const deposit = await repository.findActiveDepositByIdAndBranch({
      id: depositId,
      branchId,
      client: tx,
    });
    if (!deposit) {
      return { error: { status: 404, body: { message: 'ไม่พบข้อมูลมัดจำ' } } };
    }
    const remaining = getDepositRemainingDecimal(deposit);
    if (amountDecimal.greaterThan(remaining)) {
      return {
        error: { status: 400, body: { message: 'ยอดมัดจำคงเหลือไม่เพียงพอ' } },
      };
    }
    const updated = await repository.updateDepositById({
      id: depositId,
      data: {
        usedAmount: D(deposit.usedAmount || 0).plus(amountDecimal),
      },
      client: tx,
    });
    return { deposit: updated };
  });

  if (result.error) return result.error;
  return {
    status: 200,
    body: {
      message: 'ใช้เงินมัดจำสำเร็จ',
      deposit: normalizeDeposit(result.deposit),
    },
  };
};

module.exports = {
  createCustomerDeposit,
  getAllCustomerDeposits,
  getCustomerDepositById,
  updateCustomerDeposit,
  deleteCustomerDeposit,
  getCustomerAndDepositByPhone,
  getCustomerAndDepositByName,
  getCustomerAndDepositByCustomerId,
  useCustomerDeposit,
};
