const service = require('./superAdminCategoryRuntimeService');

const sendError = (res, error, fallbackMessage) => {
  const statusCode = error?.statusCode || 500;
  if (statusCode >= 500) console.error('[superAdminCategoryRuntimeController] error:', error);
  return res.status(statusCode).json({ error: error?.message || fallbackMessage });
};

const getAllSuperAdminCategories = async (req, res) => {
  try {
    const data = await service.listCategories({ query: req.query || {} });
    return res.status(200).json({ data });
  } catch (error) {
    return sendError(res, error, 'Failed to load categories');
  }
};

const createSuperAdminCategory = async (req, res) => {
  try {
    const data = await service.createCategory({ payload: req.body || {} });
    return res.status(201).json({ data });
  } catch (error) {
    return sendError(res, error, 'Failed to create category');
  }
};

const updateSuperAdminCategory = async (req, res) => {
  try {
    const data = await service.updateCategory({
      id: req.params?.id,
      payload: req.body || {},
    });
    return res.status(200).json({ data });
  } catch (error) {
    return sendError(res, error, 'Failed to update category');
  }
};

module.exports = {
  getAllSuperAdminCategories,
  createSuperAdminCategory,
  updateSuperAdminCategory,
};
