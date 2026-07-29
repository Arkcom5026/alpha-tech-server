// controllers/productProfileController.js
// Compatibility boundary: ProductProfile/ProductTemplate models are absent from the current Prisma schema.
// Return an explicit retirement response instead of allowing Prisma validation errors at runtime.

const retired = (_req, res) =>
  res.status(410).json({
    error: 'FEATURE_RETIRED',
    code: 'PRODUCT_PROFILE_REMOVED',
    message: 'ProductProfile ถูกถอดออกจาก Product Runtime ปัจจุบันแล้ว',
  });

module.exports = {
  createProductProfile: retired,
  getAllProductProfiles: retired,
  getProductProfileById: retired,
  updateProductProfile: retired,
  archiveProductProfile: retired,
  restoreProductProfile: retired,
  getProductProfileDropdowns: retired,
  deleteProductProfile: retired,
};
