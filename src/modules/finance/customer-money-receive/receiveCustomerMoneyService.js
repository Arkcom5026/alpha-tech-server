const { prisma } = require('../../../../lib/prisma');

const ALLOWED_PAYMENT_METHODS = new Set([
  'CASH',
  'TRANSFER',
  'CARD',
  'QR',
  'E_WALLET',
  'CHEQUE',
  'OTHER',
]);

const toPositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toMoney = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : NaN;
};

const asNullableString = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
};

const getBranchId = (user) => toPositiveInt(user?.branchId);
const getEmployeeProfileId = (user) => toPositiveInt(user?.employeeProfileId ?? user?.employeeId);

const buildError = (message, statusCode = 400, code = 'CUSTOMER_MONEY_RECEIVE_ERROR') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const normalizePaymentMethod = (value) => {
  const normalized = asNullableString(value)?.toUpperCase() || null;
  return normalized && ALLOWED_PAYMENT_METHODS.has(normalized) ? normalized : null;
};

const buildDocumentCode = async (tx, branchId, receivedAt) => {
  const date = receivedAt || new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const prefix = `CMR-${yy}${mm}${dd}-`;
  const count = await tx.customerReceipt.count({
    where: { branchId, code: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
};

const serialize = (record) => ({
  id: record.id,
  documentNo: record.code,
  branchId: record.branchId,
  customerId: record.customerId,
  receivedAt: record.receivedAt,
  amount: Number(record.totalAmount),
  remainingAmount: Number(record.remainingAmount),
  paymentMethod: record.paymentMethod,
  paymentReference: record.referenceNo || null,
  description: record.note || '',
  status: record.status,
  customer: record.customer || null,
  receivedBy: record.createdByEmployeeProfile || null,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const include = {
  customer: true,
  createdByEmployeeProfile: true,
};

async function receive(payload, user) {
  if (!payload || typeof payload !== 'object') {
    throw buildError('ข้อมูลรับเงินไม่ถูกต้อง', 400, 'INVALID_PAYLOAD');
  }

  const branchId = getBranchId(user);
  const employeeProfileId = getEmployeeProfileId(user);
  const customerId = toPositiveInt(payload.customerId);
  const amount = toMoney(payload.amount);
  const paymentMethod = normalizePaymentMethod(payload.paymentMethod);
  const paymentReference = asNullableString(payload.paymentReference);
  const description = asNullableString(payload.description);
  const receivedAt = payload.receivedAt ? new Date(payload.receivedAt) : new Date();

  if (!branchId) throw buildError('ไม่พบสาขาของผู้ทำรายการ', 400, 'BRANCH_CONTEXT_REQUIRED');
  if (!employeeProfileId) throw buildError('ไม่พบพนักงานผู้รับเงิน', 400, 'EMPLOYEE_CONTEXT_REQUIRED');
  if (!customerId) throw buildError('กรุณาเลือกลูกค้า', 400, 'CUSTOMER_REQUIRED');
  if (!Number.isFinite(amount) || amount <= 0) throw buildError('ยอดรับเงินต้องมากกว่า 0', 400, 'INVALID_AMOUNT');
  if (!paymentMethod) throw buildError('กรุณาเลือกช่องทางรับเงินให้ถูกต้อง', 400, 'INVALID_PAYMENT_METHOD');
  if (!description) throw buildError('กรุณาระบุรายละเอียดการรับเงิน', 400, 'DESCRIPTION_REQUIRED');
  if (Number.isNaN(receivedAt.getTime())) throw buildError('วันที่รับเงินไม่ถูกต้อง', 400, 'INVALID_RECEIVED_AT');

  const created = await prisma.$transaction(async (tx) => {
    const employee = await tx.employeeProfile.findFirst({
      where: { id: employeeProfileId, branchId },
      select: { id: true },
    });
    if (!employee) throw buildError('ไม่พบพนักงานผู้ทำรายการในสาขานี้', 404, 'EMPLOYEE_NOT_FOUND');

    const customer = await tx.customerProfile.findFirst({
      where: { id: customerId, branchId },
      select: { id: true },
    });
    if (!customer) throw buildError('ไม่พบลูกค้าในสาขานี้', 404, 'CUSTOMER_NOT_FOUND');

    const documentNo = await buildDocumentCode(tx, branchId, receivedAt);
    return tx.customerReceipt.create({
      data: {
        code: documentNo,
        branchId,
        customerId,
        receivedAt,
        totalAmount: amount,
        allocatedAmount: 0,
        remainingAmount: amount,
        paymentMethod,
        referenceNo: paymentReference,
        note: description,
        status: 'ACTIVE',
        createdByEmployeeProfileId: employeeProfileId,
      },
      include,
    });
  });

  return serialize(created);
}

async function list(user, query = {}) {
  const branchId = getBranchId(user);
  if (!branchId) throw buildError('ไม่พบสาขาของผู้ใช้งาน', 400, 'BRANCH_CONTEXT_REQUIRED');

  const customerId = toPositiveInt(query.customerId);
  const records = await prisma.customerReceipt.findMany({
    where: {
      branchId,
      ...(customerId ? { customerId } : {}),
      code: { startsWith: 'CMR-' },
    },
    include,
    orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
    take: 100,
  });

  return records.map(serialize);
}

async function getById(id, user) {
  const branchId = getBranchId(user);
  const recordId = toPositiveInt(id);
  if (!branchId) throw buildError('ไม่พบสาขาของผู้ใช้งาน', 400, 'BRANCH_CONTEXT_REQUIRED');
  if (!recordId) throw buildError('รหัสเอกสารไม่ถูกต้อง', 400, 'INVALID_DOCUMENT_ID');

  const record = await prisma.customerReceipt.findFirst({
    where: { id: recordId, branchId, code: { startsWith: 'CMR-' } },
    include,
  });
  if (!record) throw buildError('ไม่พบเอกสารรับเงิน', 404, 'DOCUMENT_NOT_FOUND');
  return serialize(record);
}

module.exports = {
  receive,
  list,
  getById,
};
