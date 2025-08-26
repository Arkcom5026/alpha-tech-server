// ✅ server/controllers/upload/uploadProductController.js — Prisma singleton, safer errors, cover handling

const { prisma, Prisma } = require('../../lib/prisma');
const { v4: uuidv4 } = require('uuid');
const streamifier = require('streamifier');
const { cloudinary } = require('../../utils/cloudinary');

// Helpers
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));

const uploadAndSaveProductImages = async (req, res) => {
  const productId = toInt(req.params.id);
  const file = req.file;

  const captionsArray = Array.isArray(req.body?.captions)
    ? req.body.captions
    : typeof req.body?.captions === 'string'
    ? [req.body.captions]
    : [];

  const coverIndex = toInt(req.body?.coverIndex);

  console.log('🛠️ [UPLOAD] เริ่มอัปโหลดภาพ Product');
  console.log('📥 productId:', productId);
  console.log('📥 file:', file?.originalname);
  console.log('📥 captionsArray:', captionsArray);
  console.log('📥 coverIndex:', coverIndex);

  try {
    if (!file || !productId) {
      return res.status(400).json({ message: 'ไม่พบ productId หรือไฟล์ภาพไม่ถูกต้อง' });
    }

    // ✅ ตรวจว่ามีสินค้าอยู่จริง (กัน productId หลุด)
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) return res.status(404).json({ message: 'ไม่พบสินค้า' });

    const uniqueName = uuidv4();
    const folder = 'products';
    const publicId = `${folder}/${uniqueName}`;

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          folder,
          resource_type: 'image',
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload error:', error);
            return reject(error);
          }
          console.log('✅ Cloudinary upload result:', result);
          resolve(result);
        }
      );
      streamifier.createReadStream(file.buffer).pipe(stream);
    });

    // ✅ จัดการ cover ให้มีได้เพียงรูปเดียวต่อ product (อะตอมมิก)
    const newImage = await prisma.$transaction(async (tx) => {
      if (coverIndex === 0) {
        await tx.productImage.updateMany({ where: { productId }, data: { isCover: false } });
      }
      const created = await tx.productImage.create({
        data: {
          productId,
          url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
          secure_url: uploadResult.secure_url,
          caption: captionsArray[0] || '',
          isCover: coverIndex === 0,
        },
      });
      return created;
    });

    console.log('🧾 สร้างข้อมูลใน DB แล้ว:', newImage);

    return res.json({
      message: 'อัปโหลดและบันทึกภาพสำเร็จ',
      images: [newImage],
    });
  } catch (err) {
    console.error('❌ uploadAndSaveProductImages error:', err);
    return res.status(500).json({ message: 'Upload and Save failed' });
  }
};

const uploadProductImagesOnly = async (req, res) => {
  const files = req.files;

  const captionsArray = Array.isArray(req.body?.captions)
    ? req.body.captions
    : typeof req.body?.captions === 'string'
    ? [req.body.captions]
    : [];

  const coverIndex = toInt(req.body?.coverIndex);

  console.log('🛠️ [UPLOAD ONLY] เริ่มอัปโหลดภาพ Product (temp)');
  console.log('📥 จำนวนไฟล์:', files?.length);
  console.log('📥 captionsArray:', captionsArray);
  console.log('📥 coverIndex:', coverIndex);

  try {
    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'ไม่พบไฟล์ภาพที่อัปโหลด' });
    }

    const uploads = await Promise.all(
      files.map(async (file, index) => {
        const uniqueName = uuidv4();
        const folder = 'products';
        const publicId = `${folder}/${uniqueName}`;

        console.log(`📤 เริ่ม upload: ${file.originalname} → ${publicId}`);

        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              public_id: publicId,
              folder,
              resource_type: 'image',
            },
            (error, result) => {
              if (error) {
                console.error('❌ Cloudinary upload error:', error);
                return reject(error);
              }
              console.log('✅ Cloudinary upload result:', result);
              resolve({
                url: result.secure_url,
                public_id: result.public_id,
                secure_url: result.secure_url,
                caption: captionsArray[index] || '',
                isCover: index === coverIndex,
              });
            }
          );
          streamifier.createReadStream(file.buffer).pipe(stream);
        });
      })
    );

    console.log('🧾 อัปโหลดภาพสำเร็จ');

    return res.json({
      message: 'อัปโหลดภาพสำเร็จ',
      images: uploads,
    });
  } catch (err) {
    console.error('❌ uploadProductImagesOnly error:', err);
    return res.status(500).json({ message: 'Upload failed' });
  }
};

const deleteProductImage = async (req, res) => {
  const productId = toInt(req.params.id);
  const { public_id } = req.body || {};

  console.log('🗑️ [DELETE] เริ่มลบภาพ:', public_id);

  try {
    if (!public_id || !productId) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
    }

    await cloudinary.uploader.destroy(public_id);

    await prisma.productImage.deleteMany({
      where: { productId, public_id },
    });

    console.log('✅ ลบภาพสำเร็จจาก Cloudinary และฐานข้อมูล');
    return res.json({ message: 'ลบภาพสำเร็จ' });
  } catch (err) {
    console.error('❌ deleteProductImage error:', err);
    return res.status(500).json({ message: 'ลบภาพไม่สำเร็จ' });
  }
};

module.exports = {
  uploadProductImagesOnly,
  uploadAndSaveProductImages,
  deleteProductImage,
};
