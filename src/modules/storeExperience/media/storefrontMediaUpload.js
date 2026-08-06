'use strict';

const multer = require('multer');

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const uploadStorefrontMedia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (String(file?.mimetype || '').toLowerCase().startsWith('image/')) {
      return callback(null, true);
    }
    const error = new Error('รองรับเฉพาะไฟล์รูปภาพ');
    error.code = 'STOREFRONT_MEDIA_IMAGE_REQUIRED';
    return callback(error, false);
  },
});

module.exports = {
  MAX_FILE_SIZE_BYTES,
  uploadStorefrontMedia,
};
