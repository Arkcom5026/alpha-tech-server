const multer = require('multer');
const { RepairError, RepairFailureCode } = require('../contracts/repairError');

const intakeEvidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 6,
    fileSize: 8 * 1024 * 1024,
  },
  fileFilter: (_req, file, done) => {
    if (!String(file.mimetype || '').startsWith('image/')) {
      return done(new Error('รองรับเฉพาะไฟล์ภาพเท่านั้น'));
    }
    return done(null, true);
  },
});

function handleIntakeEvidenceUpload(req, res, next) {
  intakeEvidenceUpload.array('photos', 6)(req, res, (error) => {
    if (!error) return next();
    return next(
      new RepairError(
        RepairFailureCode.INVALID_INPUT,
        error.code === 'LIMIT_FILE_SIZE'
          ? 'ภาพหลักฐานแต่ละไฟล์ต้องมีขนาดไม่เกิน 8 MB'
          : error.message || 'ไฟล์หลักฐานไม่ถูกต้อง',
        400
      )
    );
  });
}

module.exports = handleIntakeEvidenceUpload;
