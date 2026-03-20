

// ===============================
// superAdminCategoryController.js
// Location: server/controllers/superAdminCategoryController.js
// ===============================

const { prisma } = require('../lib/prisma');

const normalizeName = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const parseBooleanQuery = (value) => {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return undefined;
};

const getAllSuperAdminCategories = async (req, res) => {
  try {
    const q = normalizeName(req.query.q || '');
    const active = parseBooleanQuery(req.query.active);
    const includeSystem = parseBooleanQuery(req.query.includeSystem);

    const where = {};

    if (q) {
      where.name = {
        contains: q,
        mode: 'insensitive',
      };
    }

    if (typeof active === 'boolean') {
      where.active = active;
    }

    if (includeSystem === false) {
      where.isSystem = false;
    }

    const categories = await prisma.category.findMany({
      where,
      orderBy: [
        { isSystem: 'desc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        active: true,
        isSystem: true,
      },
    });

    return res.status(200).json({ data: categories });
  } catch (error) {
    console.error('[getAllSuperAdminCategories] error:', error);
    return res.status(500).json({ error: 'Failed to load categories' });
  }
};

const createSuperAdminCategory = async (req, res) => {
  try {
    const name = normalizeName(req.body.name);
    const active = typeof req.body.active === 'boolean' ? req.body.active : true;

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const existing = await prisma.category.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      return res.status(409).json({ error: 'Category name already exists' });
    }

    const created = await prisma.category.create({
      data: {
        name,
        active,
      },
      select: {
        id: true,
        name: true,
        active: true,
        isSystem: true,
      },
    });

    return res.status(201).json({ data: created });
  } catch (error) {
    console.error('[createSuperAdminCategory] error:', error);
    return res.status(500).json({ error: 'Failed to create category' });
  }
};

const updateSuperAdminCategory = async (req, res) => {
  try {
    const categoryId = Number(req.params.id);
    const name = normalizeName(req.body.name);
    const active = typeof req.body.active === 'boolean' ? req.body.active : undefined;

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return res.status(400).json({ error: 'Invalid category id' });
    }

    const existing = await prisma.category.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        name: true,
        active: true,
        isSystem: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (existing.isSystem && name && name !== existing.name) {
      return res.status(403).json({ error: 'System category name cannot be changed' });
    }

    if (!existing.isSystem && name) {
      const duplicate = await prisma.category.findFirst({
        where: {
          id: { not: categoryId },
          name: {
            equals: name,
            mode: 'insensitive',
          },
        },
        select: {
          id: true,
        },
      });

      if (duplicate) {
        return res.status(409).json({ error: 'Category name already exists' });
      }
    }

    const data = {};

    if (!existing.isSystem && name) {
      data.name = name;
    }

    if (typeof active === 'boolean') {
      data.active = active;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data,
      select: {
        id: true,
        name: true,
        active: true,
        isSystem: true,
      },
    });

    return res.status(200).json({ data: updated });
  } catch (error) {
    console.error('[updateSuperAdminCategory] error:', error);
    return res.status(500).json({ error: 'Failed to update category' });
  }
};

module.exports = {
  getAllSuperAdminCategories,
  createSuperAdminCategory,
  updateSuperAdminCategory,
};



