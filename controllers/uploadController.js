
// ✅ controllers/uploadController.js
const { cloudinary } = require('../utils/cloudinary');
const prisma = require('../lib/prisma');


const uploadImage = async (req, res) => {
  try {
    console.log('📥 เริ่มรับคำขออัปโหลดภาพ');

    if (!req.files || req.files.length === 0) {
      console.warn('⚠️ ไม่พบไฟล์ที่อัปโหลด');
      return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log(`📦 รับไฟล์จำนวน ${req.files.length} ไฟล์`);
    req.files.forEach((file, index) => {
      console.log(`🧾 [${index + 1}] filename: ${file.filename}, mimetype: ${file.mimetype}, size: ${file.size}`);
    });

    const uploaded = req.files.map((file) => ({
      url: file.path,
      secure_url: file.path,
      public_id: file.filename,
    }));

    console.log('🖼️ อัปโหลดสำเร็จ:', uploaded);
    res.json(uploaded);
  } catch (error) {
    console.error('❌ Cloudinary Upload Error:', error);
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
};

module.exports = {
  uploadImage,
};
// ปิดท้าย uploadController.js