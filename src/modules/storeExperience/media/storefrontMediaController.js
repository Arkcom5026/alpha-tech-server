'use strict';

const { storefrontMediaService } = require('./storefrontMediaService');

const branchIdOf = (req) => Number(req.employee?.branchId || req.user?.branchId);

const sendError = (res, error) => {
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      code: 'STOREFRONT_MEDIA_TOO_LARGE',
      message: 'รูปภาพต้องมีขนาดไม่เกิน 5 MB',
    });
  }
  return res.status(error?.statusCode || 500).json({
    success: false,
    code: error?.code || 'STOREFRONT_MEDIA_REQUEST_FAILED',
    message: error?.message || 'ดำเนินการกับรูปภาพหน้าร้านไม่สำเร็จ',
  });
};

const requireBranchId = (req, res) => {
  const branchId = branchIdOf(req);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    res.status(403).json({
      success: false,
      code: 'EMPLOYEE_BRANCH_CONTEXT_REQUIRED',
      message: 'ไม่พบร้านของผู้ดำเนินการ',
    });
    return null;
  }
  return branchId;
};

const uploadStorefrontMedia = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return undefined;

    const data = await storefrontMediaService.upload({
      branchId,
      purpose: req.body?.purpose,
      file: req.file,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
};

const listStorefrontMedia = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return undefined;

    const data = await storefrontMediaService.list({
      branchId,
      purpose: req.query?.purpose,
      search: req.query?.search,
      pageSize: req.query?.pageSize,
      nextCursor: req.query?.nextCursor,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
};

module.exports = {
  branchIdOf,
  requireBranchId,
  sendError,
  uploadStorefrontMedia,
  listStorefrontMedia,
};
