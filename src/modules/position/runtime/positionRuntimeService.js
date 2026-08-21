const repository = require('./positionRuntimeRepository');
const {
  POSITION_CAPABILITIES,
  normalizeCapabilityArray,
} = require('../../employee/authorization/employeePositionAuthority');

const SUPPORTED_CAPABILITIES = new Set(Object.values(POSITION_CAPABILITIES));

const toInt = (value, fallback = null) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : value);
const normalizeDescription = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};
const normalizeRoleField = (row = {}) => ({
  ...row,
  role: row.role ?? row.defaultRole ?? row.systemRole ?? null,
});

const createError = (statusCode, payload) => {
  const error = new Error(payload.error || payload.message || 'position_runtime_error');
  error.statusCode = statusCode;
  error.payload = payload;
  return error;
};

const normalizeCapabilitiesInput = (value) => {
  const normalized = normalizeCapabilityArray(value);
  if (normalized === null) {
    throw createError(400, { error: 'รูปแบบสิทธิ์ของตำแหน่งงานไม่ถูกต้อง' });
  }

  const unsupported = normalized.filter((key) => !SUPPORTED_CAPABILITIES.has(key));
  if (unsupported.length > 0) {
    throw createError(400, {
      code: 'POSITION_CAPABILITY_UNSUPPORTED',
      message: `พบสิทธิ์ของตำแหน่งงานที่ระบบยังไม่รองรับ: ${unsupported.join(', ')}`,
    });
  }
  return normalized;
};

const ensureBranchId = (branchId) => {
  const normalized = toInt(branchId);
  if (!normalized) {
    throw createError(403, {
      code: 'BRANCH_CONTEXT_REQUIRED',
      message: 'ไม่พบข้อมูลสาขาสำหรับบัญชีผู้ใช้นี้',
    });
  }
  return normalized;
};

const ensureId = (value) => {
  const id = toInt(value);
  if (!id) throw createError(400, { error: 'รหัสไม่ถูกต้อง' });
  return id;
};

const ensureNameAvailable = async ({ branchId, name, excludeId = null }) => {
  const conflict = await repository.findNameConflict({ branchId, name, excludeId });
  if (conflict) throw createError(409, { error: 'ชื่อตำแหน่งนี้ถูกใช้แล้วในสาขา' });
};

const listPositions = async ({ branchId, query = {} }) => {
  const normalizedBranchId = ensureBranchId(branchId);
  const q = String(query.q ?? query.search ?? '').trim();
  const page = Math.max(toInt(query.page, 1), 1);
  const limit = Math.min(Math.max(toInt(query.limit, 20), 1), 100);
  const where = {
    branchId: normalizedBranchId,
    ...(query.active === 'true' ? { isActive: true } : {}),
    ...(query.active === 'false' ? { isActive: false } : {}),
    ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
  };
  const [itemsRaw, total] = await repository.listPositions({
    where,
    skip: (page - 1) * limit,
    take: limit,
  });
  return {
    items: itemsRaw.map(normalizeRoleField),
    meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  };
};

const getDropdowns = async ({ branchId, query = {} }) => {
  const normalizedBranchId = ensureBranchId(branchId);
  const where = {
    branchId: normalizedBranchId,
    ...(query.active === 'true' || query.active == null ? { isActive: true } : {}),
    ...(query.active === 'false' ? { isActive: false } : {}),
  };
  return repository.listDropdowns({ where });
};

const getById = async ({ branchId, id }) => {
  const item = await repository.findByIdForBranch({
    id: ensureId(id),
    branchId: ensureBranchId(branchId),
  });
  if (!item) throw createError(404, { error: 'ไม่พบข้อมูลตำแหน่ง' });
  return normalizeRoleField(item);
};

const createPosition = async ({ branchId, body = {} }) => {
  const normalizedBranchId = ensureBranchId(branchId);
  const name = normalizeText(body.name);
  const description = normalizeDescription(body.description);
  const hasCapabilities = Object.prototype.hasOwnProperty.call(body, 'capabilities');
  const capabilities = hasCapabilities ? normalizeCapabilitiesInput(body.capabilities) : undefined;
  if (typeof name !== 'string' || name.length < 2) {
    throw createError(400, { error: 'ชื่อตำแหน่งต้องยาวอย่างน้อย 2 ตัวอักษร' });
  }
  if (description != null && typeof description !== 'string') {
    throw createError(400, { error: 'รูปแบบคำอธิบายไม่ถูกต้อง' });
  }
  await ensureNameAvailable({ branchId: normalizedBranchId, name });
  try {
    return normalizeRoleField(
      await repository.createPosition({
        name,
        description,
        ...(hasCapabilities ? { capabilities } : {}),
        branchId: normalizedBranchId,
        isActive: true,
      }),
    );
  } catch (error) {
    if (repository.isUniqueConstraintError(error)) {
      throw createError(409, { error: 'ชื่อตำแหน่งนี้ถูกใช้แล้วในสาขา' });
    }
    throw error;
  }
};

const updatePosition = async ({ branchId, id, body = {} }) => {
  const normalizedBranchId = ensureBranchId(branchId);
  const normalizedId = ensureId(id);
  const existing = await repository.findByIdForBranch({ id: normalizedId, branchId: normalizedBranchId });
  if (!existing) throw createError(404, { error: 'ไม่พบข้อมูลตำแหน่ง' });
  const data = {};
  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    const name = normalizeText(body.name);
    if (typeof name !== 'string' || name.length < 2) {
      throw createError(400, { error: 'ชื่อตำแหน่งต้องยาวอย่างน้อย 2 ตัวอักษร' });
    }
    await ensureNameAvailable({ branchId: normalizedBranchId, name, excludeId: normalizedId });
    data.name = name;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    const description = normalizeDescription(body.description);
    if (description != null && typeof description !== 'string') {
      throw createError(400, { error: 'รูปแบบคำอธิบายไม่ถูกต้อง' });
    }
    data.description = description;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'capabilities')) {
    data.capabilities = normalizeCapabilitiesInput(body.capabilities);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'isActive')) {
    if (typeof body.isActive !== 'boolean') {
      throw createError(400, { error: 'รูปแบบ isActive ต้องเป็น boolean' });
    }
    data.isActive = body.isActive;
  }
  if (Object.keys(data).length === 0) {
    throw createError(400, { error: 'ไม่มีข้อมูลที่รองรับสำหรับการแก้ไข' });
  }
  try {
    return normalizeRoleField(await repository.updatePosition({ id: normalizedId, data }));
  } catch (error) {
    if (repository.isUniqueConstraintError(error)) {
      throw createError(409, { error: 'ชื่อตำแหน่งนี้ถูกใช้แล้วในสาขา' });
    }
    throw error;
  }
};

const toggleActive = async ({ branchId, id }) => {
  const normalizedBranchId = ensureBranchId(branchId);
  const normalizedId = ensureId(id);
  const existing = await repository.findByIdForBranch({ id: normalizedId, branchId: normalizedBranchId });
  if (!existing) throw createError(404, { error: 'ไม่พบข้อมูลตำแหน่ง' });
  if (existing.isActive) {
    const inUse = await repository.countEmployeesUsingPosition({
      branchId: normalizedBranchId,
      positionId: normalizedId,
    });
    if (inUse > 0) {
      throw createError(409, {
        error: 'ไม่สามารถปิดใช้งานได้: มีพนักงานที่ยังผูกกับตำแหน่งนี้อยู่',
      });
    }
  }
  return normalizeRoleField(
    await repository.updatePosition({
      id: normalizedId,
      data: { isActive: !existing.isActive },
    }),
  );
};

const hardDelete = async ({ branchId, id }) => {
  const normalizedBranchId = ensureBranchId(branchId);
  const normalizedId = ensureId(id);
  const existing = await repository.findByIdForBranch({
    id: normalizedId,
    branchId: normalizedBranchId,
    select: { id: true },
  });
  if (!existing) throw createError(404, { error: 'ไม่พบข้อมูลตำแหน่ง' });
  const inUse = await repository.countEmployeesUsingPosition({
    branchId: normalizedBranchId,
    positionId: normalizedId,
  });
  if (inUse > 0) {
    throw createError(409, { error: 'ไม่สามารถลบได้: มีพนักงานที่ยังผูกกับตำแหน่งนี้อยู่' });
  }
  try {
    await repository.deletePosition(normalizedId);
    return { message: 'ลบข้อมูลตำแหน่งแล้ว' };
  } catch (error) {
    if (repository.isForeignKeyConstraintError(error)) {
      throw createError(409, { error: 'ไม่สามารถลบได้เนื่องจากมีการอ้างอิงอยู่' });
    }
    throw error;
  }
};

module.exports = {
  listPositions,
  getDropdowns,
  getById,
  createPosition,
  updatePosition,
  toggleActive,
  hardDelete,
};
