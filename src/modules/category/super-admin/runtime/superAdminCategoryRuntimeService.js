const repository = require('./superAdminCategoryRuntimeRepository');

const normalizeName = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const parseBooleanQuery = (value) => {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return undefined;
};

const createError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const listCategories = async ({ query = {} }) => {
  const q = normalizeName(query.q || '');
  const active = parseBooleanQuery(query.active);
  const includeSystem = parseBooleanQuery(query.includeSystem);
  const where = {};

  if (q) where.name = { contains: q, mode: 'insensitive' };
  if (typeof active === 'boolean') where.active = active;
  if (includeSystem === false) where.isSystem = false;

  return repository.findMany({ where });
};

const createCategory = async ({ payload = {} }) => {
  const name = normalizeName(payload.name);
  const active = typeof payload.active === 'boolean' ? payload.active : true;

  if (!name) throw createError(400, 'Category name is required');

  const existing = await repository.findByName({ name });
  if (existing) throw createError(409, 'Category name already exists');

  return repository.create({ name, active });
};

const updateCategory = async ({ id, payload = {} }) => {
  const categoryId = Number(id);
  const name = normalizeName(payload.name);
  const active = typeof payload.active === 'boolean' ? payload.active : undefined;

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw createError(400, 'Invalid category id');
  }

  const existing = await repository.findById({ id: categoryId });
  if (!existing) throw createError(404, 'Category not found');

  if (existing.isSystem && name && name !== existing.name) {
    throw createError(403, 'System category name cannot be changed');
  }

  if (!existing.isSystem && name) {
    const duplicate = await repository.findByName({ name, excludeId: categoryId });
    if (duplicate) throw createError(409, 'Category name already exists');
  }

  const data = {};
  if (!existing.isSystem && name) data.name = name;
  if (typeof active === 'boolean') data.active = active;

  if (Object.keys(data).length === 0) {
    throw createError(400, 'No valid fields to update');
  }

  return repository.update({ id: categoryId, data });
};

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
};
