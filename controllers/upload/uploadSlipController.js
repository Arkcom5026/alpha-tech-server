// controllers/upload/uploadSlipController.js
const { cloudinary } = require('../../utils/cloudinary');
const streamifier = require('streamifier');
const { v4: uuidv4 } = require('uuid');

const uploadAndSaveSlip = async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'ไม่พบไฟล์ที่อัปโหลด' });
    }

    const folder = 'payment_slips';
    const publicId = `${folder}/${uuidv4()}`;

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          folder,
          resource_type: 'image',
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary error:', error);
            return reject(error);
          }
          resolve(result);
        }
      );
      streamifier.createReadStream(file.buffer).pipe(stream);
    });

    res.json({
      url: result.secure_url,
    });
  } catch (err) {
    console.error('❌ uploadAndSaveSlip error:', err);
    res.status(500).json({ error: 'Upload slip failed' });
  }
};

module.exports = { uploadAndSaveSlip };
