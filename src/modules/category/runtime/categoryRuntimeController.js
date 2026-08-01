const service = require('./categoryRuntimeService');

const sendResult = (res, result, options = {}) => {
  if (result?.error) return res.status(result.error.status).json(result.error.body);
  if (options.noStore) res.set('Cache-Control', 'no-store');
  return res.status(result?.status || 200).json(result?.data ?? result);
};

const getAllCategories = async (req, res) => {
  try {
    return sendResult(res, await service.listCategories(req.query), { noStore: true });
  } catch (error) {
    console.error('❌ [getAllCategories] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถโหลดหมวดหมู่ได้' });
  }
};

const getCategoryById = async (req, res) => {
  try {
    return sendResult(res, await service.getCategoryById(req.params?.id));
  } catch (error) {
    console.error('❌ [getCategoryById] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถดึงหมวดหมู่ได้' });
  }
};

const createCategory = async (req, res) => {
  try {
    return sendResult(res, await service.createCategory(req.body));
  } catch (error) {
    console.error('❌ [createCategory] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถสร้างหมวดหมู่ได้' });
  }
};

const updateCategory = async (req, res) => {
  try {
    return sendResult(res, await service.updateCategory(req.params?.id, req.body));
  } catch (error) {
    console.error('❌ [updateCategory] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถแก้ไขหมวดหมู่ได้' });
  }
};

const archiveCategory = async (req, res) => {
  try {
    return sendResult(res, await service.archiveCategory(req.params?.id));
  } catch (error) {
    console.error('❌ [archiveCategory] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถปิดการใช้งานหมวดหมู่ได้' });
  }
};

const restoreCategory = async (req, res) => {
  try {
    return sendResult(res, await service.restoreCategory(req.params?.id));
  } catch (error) {
    console.error('❌ [restoreCategory] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถกู้คืนหมวดหมู่ได้' });
  }
};

const getCategoryDropdowns = async (_req, res) => {
  try {
    return sendResult(res, { data: await service.getCategoryDropdowns() }, { noStore: true });
  } catch (error) {
    console.error('❌ [getCategoryDropdowns] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถดึง dropdown หมวดหมู่ได้' });
  }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  archiveCategory,
  restoreCategory,
  getCategoryDropdowns,
};
