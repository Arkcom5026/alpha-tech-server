const service = require('./branchRuntimeService');

const sendError = (res, error, fallbackMessage) => {
  const statusCode = error?.statusCode || error?.status || 500;
  if (statusCode >= 500) console.error('[branchRuntimeController]', error);
  return res.status(statusCode).json({
    error: error?.code || 'BRANCH_RUNTIME_FAILED',
    code: error?.code || 'BRANCH_RUNTIME_FAILED',
    message: error?.message || fallbackMessage,
  });
};

const getAllBranches = async (_req, res) => {
  try {
    return res.json(await service.listBranches());
  } catch (error) {
    return sendError(res, error, 'ไม่สามารถโหลดข้อมูลสาขาได้');
  }
};

const getBranchById = async (req, res) => {
  try {
    return res.json(await service.getBranchById(req.params?.id));
  } catch (error) {
    return sendError(res, error, 'ไม่สามารถโหลดข้อมูลสาขาได้');
  }
};

const getBranchBySlug = async (req, res) => {
  try {
    return res.json(await service.getBranchBySlug(req.params?.slug));
  } catch (error) {
    return sendError(res, error, 'ไม่สามารถโหลดข้อมูลโปรไฟล์พาร์ตเนอร์ได้');
  }
};

const createBranch = async (req, res) => {
  try {
    return res.status(201).json(await service.createBranch(req.body || {}));
  } catch (error) {
    return sendError(res, error, 'ไม่สามารถสร้างสาขาได้');
  }
};

const updateBranch = async (req, res) => {
  try {
    return res.json(await service.updateBranch(req.params?.id, req.body || {}));
  } catch (error) {
    return sendError(res, error, 'ไม่สามารถอัปเดตสาขาได้');
  }
};

const deleteBranch = async (req, res) => {
  try {
    return res.json(await service.deleteBranch(req.params?.id));
  } catch (error) {
    return sendError(res, error, 'ไม่สามารถลบสาขาได้');
  }
};

module.exports = {
  getAllBranches,
  getBranchById,
  getBranchBySlug,
  createBranch,
  updateBranch,
  deleteBranch,
};
