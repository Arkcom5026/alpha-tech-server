const repository = require('./categoryRuntimeRepository');

const toInt = (value) =>
  value === undefined || value === null || value === '' ? undefined : Number(value);

const buildListFilters = (query = {}) => {
  const q = String(query.q ?? query.search ?? '').trim();
  const page = Number(query.page) > 0 ? Number(query.page) : 1;
  const limit = Number(query.limit) > 0 ? Number(query.limit) : 20;
  const includeInactive = String(query.includeInactive).toLowerCase() === 'true';

  return {
    page,
    limit,
    where: {
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      ...(includeInactive ? {} : { active: true }),
    },
  };
};

const listCategories = async (query) => {
  const filters = buildListFilters(query);
  const [total, items] = await Promise.all([
    repository.countCategories(filters.where),
    repository.listCategories(filters),
  ]);
  return { items, total, page: filters.page, limit: filters.limit };
};

const getCategoryById = async (rawId) => {
  const id = toInt(rawId);
  if (!id) return { error: { status: 400, body: { message: 'id ไม่ถูกต้อง' } } };
  const category = await repository.findCategoryById(id);
  if (!category) return { error: { status: 404, body: { message: 'ไม่พบหมวดหมู่' } } };
  return { data: category };
};

const createCategory = async (body = {}) => {
  const name = String(body.name || '').trim();
  if (!name) return { error: { status: 400, body: { message: 'กรุณาระบุชื่อหมวดหมู่' } } };
  try {
    const data = await repository.createCategory({
      name,
      active: true,
      isSystem: Boolean(body.isSystem) === true,
    });
    return { status: 201, data };
  } catch (error) {
    if (repository.isKnownRequestError(error, 'P2002')) {
      return { error: { status: 409, body: { message: 'ชื่อหมวดหมู่ซ้ำ (unique constraint)' } } };
    }
    throw error;
  }
};

const updateCategory = async (rawId, body = {}) => {
  const id = toInt(rawId);
  if (!id) return { error: { status: 400, body: { message: 'id ไม่ถูกต้อง' } } };
  const name = String(body.name || '').trim();
  if (!name) return { error: { status: 400, body: { message: 'กรุณาระบุชื่อหมวดหมู่' } } };

  const current = await repository.findCategoryById(id, { id: true, isSystem: true });
  if (!current) {
    return { error: { status: 404, body: { message: 'ไม่พบหมวดหมู่ที่ต้องการแก้ไข' } } };
  }
  if (current.isSystem) {
    return { error: { status: 403, body: { message: 'หมวดระบบ (isSystem) ไม่อนุญาตให้แก้ไข' } } };
  }

  try {
    return { data: await repository.updateCategory(id, { name }) };
  } catch (error) {
    if (repository.isKnownRequestError(error, 'P2025')) {
      return { error: { status: 404, body: { message: 'ไม่พบหมวดหมู่ที่ต้องการแก้ไข' } } };
    }
    if (repository.isKnownRequestError(error, 'P2002')) {
      return { error: { status: 409, body: { message: 'ชื่อหมวดหมู่ซ้ำ (unique constraint)' } } };
    }
    throw error;
  }
};

const archiveCategory = async (rawId) => {
  const id = toInt(rawId);
  if (!id) return { error: { status: 400, body: { message: 'id ไม่ถูกต้อง' } } };

  const current = await repository.findCategoryById(id, { id: true, active: true, isSystem: true });
  if (!current) {
    return { error: { status: 404, body: { message: 'ไม่พบหมวดหมู่ที่ต้องการปิดการใช้งาน' } } };
  }
  if (current.isSystem) {
    return { error: { status: 403, body: { message: 'หมวดระบบ (isSystem) ไม่อนุญาตให้ปิดการใช้งาน' } } };
  }

  const conflict = await repository.findGlobalProductTypeReference(id);
  if (conflict) {
    return {
      error: {
        status: 409,
        body: {
          error: 'HAS_REFERENCES',
          message: 'ไม่สามารถปิดการใช้งานได้ เพราะมีประเภทสินค้ากลาง (GlobalProductType) อ้างอิงอยู่',
          conflict,
        },
      },
    };
  }

  if (current.active === false) return { data: { message: 'หมวดหมู่นี้ถูกปิดการใช้งานอยู่แล้ว', id } };

  try {
    await repository.updateCategory(id, { active: false });
    return { data: { message: 'ปิดการใช้งานหมวดหมู่เรียบร้อย', id } };
  } catch (error) {
    if (repository.isKnownRequestError(error, 'P2025')) {
      return { error: { status: 404, body: { message: 'ไม่พบหมวดหมู่ที่ต้องการปิดการใช้งาน' } } };
    }
    throw error;
  }
};

const restoreCategory = async (rawId) => {
  const id = toInt(rawId);
  if (!id) return { error: { status: 400, body: { message: 'id ไม่ถูกต้อง' } } };

  const current = await repository.findCategoryById(id, { id: true, active: true });
  if (!current) {
    return { error: { status: 404, body: { message: 'ไม่พบหมวดหมู่ที่ต้องการกู้คืน' } } };
  }
  if (current.active === true) return { data: { message: 'หมวดหมู่นี้อยู่ในสถานะใช้งานแล้ว', id } };

  try {
    await repository.updateCategory(id, { active: true });
    return { data: { message: 'กู้คืนหมวดหมู่เรียบร้อย', id } };
  } catch (error) {
    if (repository.isKnownRequestError(error, 'P2025')) {
      return { error: { status: 404, body: { message: 'ไม่พบหมวดหมู่ที่ต้องการกู้คืน' } } };
    }
    throw error;
  }
};

const getCategoryDropdowns = () => repository.listCategoryDropdowns();

module.exports = {
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  archiveCategory,
  restoreCategory,
  getCategoryDropdowns,
};
