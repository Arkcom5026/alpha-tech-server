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
    code: error?.code || 'STOREFRONT_MEDIA_UPLOAD_FAILED',
    message: error?.message || 'อัปโหลดรูปภาพหน้าร้านไม่สำเร็จ',
  });
};

const uploadStorefrontMedia = async (req, res) => {
  try {
    const branchId = branchIdOf(req);
    if (!Number.isInteger(branchId) || branchId <= 0) {
      return res.status(403).json({
        success: false,
        code: 'EMPLOYEE_BRANCH_CONTEXT_REQUIRED',
        message: 'ไม่พบร้านของผู้ดำเนินการ',
      });
    }

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

module.exports = {
  branchIdOf,
  sendError,
  uploadStorefrontMedia,
};
