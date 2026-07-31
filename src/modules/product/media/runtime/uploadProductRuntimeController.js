const service = require('./uploadProductRuntimeService');

const sendServiceResult = (res, result) => res.status(result.status).json(result.body);

const uploadProductImagesOnly = async (req, res) => {
  try {
    const result = await service.uploadProductImagesOnly({
      files: req.files,
      body: req.body || {},
    });
    return sendServiceResult(res, result);
  } catch (error) {
    console.error('❌ uploadProductImagesOnly error:', error);
    return res.status(500).json({ message: 'Upload failed' });
  }
};

const uploadAndSaveProductImages = async (req, res) => {
  try {
    const result = await service.uploadAndSaveProductImages({
      productId: req.params?.id,
      file: req.file,
      files: req.files,
      body: req.body || {},
    });
    return sendServiceResult(res, result);
  } catch (error) {
    console.error('❌ uploadAndSaveProductImages error:', error);
    return res.status(500).json({ message: 'Upload and Save failed' });
  }
};

const deleteProductImage = async (req, res) => {
  try {
    const result = await service.deleteProductImage({
      productId: req.params?.id,
      imageId: req.params?.imageId ?? req.body?.imageId ?? req.body?.id,
      publicId: req.body?.publicId ?? req.body?.public_id,
    });
    return sendServiceResult(res, result);
  } catch (error) {
    console.error('❌ deleteProductImage error:', error);
    return res.status(500).json({ message: 'Delete image failed' });
  }
};

const setProductCoverImage = async (req, res) => {
  try {
    const result = await service.setProductCoverImage({
      productId: req.params?.id,
      imageId: req.params?.imageId,
    });
    return sendServiceResult(res, result);
  } catch (error) {
    console.error('❌ setProductCoverImage error:', error);
    return res.status(500).json({ message: 'Set cover failed' });
  }
};

module.exports = {
  uploadProductImagesOnly,
  uploadAndSaveProductImages,
  deleteProductImage,
  setProductCoverImage,
};
