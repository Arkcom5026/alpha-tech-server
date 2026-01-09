

// ✅ server/controllers/upload/uploadProductController.js — Prisma singleton, safer errors, cover handling

const { prisma, Prisma } = require('../../lib/prisma');
const { v4: uuidv4 } = require('uuid');
const streamifier = require('streamifier');
const { cloudinary } = require('../../utils/cloudinary');

// Helpers
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));

const uploadAndSaveProductImages = async (req, res) => {
  const productId = toInt(req.params.id);
  // ✅ FE บางจุดอาจส่ง field ผิด (เช่น files แทน file) → รองรับแบบปลอดภัย (เลือกไฟล์แรก)
  const file = req.file ?? (Array.isArray(req.files) && req.files[0] ? req.files[0] : undefined);

  // ✅ รองรับทั้ง captions[] และ caption (กรณีอัปโหลดทีละรูป)
  const captionsArray = Array.isArray(req.body?.captions)
    ? req.body.captions
    : typeof req.body?.captions === 'string'
    ? [req.body.captions]
    : typeof req.body?.caption === 'string'
    ? [req.body.caption]
    : [];

  const coverIndex = toInt(req.body?.coverIndex);

  console.log('🛠️ [UPLOAD] เริ่มอัปโหลดภาพ Product');
  console.log('📥 productId:', productId);
  console.log('📥 file:', file?.originalname);
  console.log('📥 captionsArray:', captionsArray);
  console.log('📥 coverIndex:', coverIndex);

  try {
    if (!file || !productId) {
      return res.status(400).json({
        message:
          'ไม่พบ productId หรือไฟล์ภาพไม่ถูกต้อง (upload-full ต้องส่ง field = "file" แบบ multer.single หรือส่งเป็น "files" แล้วระบบจะหยิบไฟล์แรกให้)',
      });
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

  // ✅ รองรับทั้ง captions[] และ caption
  const captionsArray = Array.isArray(req.body?.captions)
    ? req.body.captions
    : typeof req.body?.captions === 'string'
    ? [req.body.captions]
    : typeof req.body?.caption === 'string'
    ? [req.body.caption]
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

// ✅ ตั้งรูปนี้เป็น Cover (ต้องมีแค่ 1 รูปที่เป็น cover ต่อสินค้า)
// PATCH /api/products/:id/images/:imageId/cover
const setProductCoverImage = async (req, res) => {
  const productId = toInt(req.params.id);
  const imageId = toInt(req.params.imageId);

  try {
    if (!productId || !imageId) {
      return res.status(400).json({ message: 'Missing productId or imageId' });
    }

    // ✅ ตรวจว่าสินค้ามีอยู่จริง
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) return res.status(404).json({ message: 'ไม่พบสินค้า' });

    // ✅ ตรวจว่ารูปนี้เป็นของสินค้านี้จริง และยัง active
    const image = await prisma.productImage.findFirst({
      where: { id: imageId, productId, active: true },
      select: { id: true },
    });
    if (!image) return res.status(404).json({ message: 'ไม่พบรูปภาพของสินค้านี้' });

    const images = await prisma.$transaction(async (tx) => {
      // เคลียร์ cover เก่าทั้งหมด
      await tx.productImage.updateMany({ where: { productId }, data: { isCover: false } });
      // ตั้ง cover ใหม่
      await tx.productImage.update({ where: { id: imageId }, data: { isCover: true } });

      // ส่งรายการรูปที่ยัง active กลับไป (ไว้ให้ FE รีเฟรช UI)
      const refreshed = await tx.productImage.findMany({
        where: { productId, active: true },
        orderBy: [{ isCover: 'desc' }, { createdAt: 'asc' }],
        select: { id: true, url: true, caption: true, isCover: true, public_id: true },
      });
      return refreshed;
    });

    return res.json({ message: 'ตั้งรูปหน้าปกสำเร็จ', images });
  } catch (err) {
    console.error('❌ setProductCoverImage error:', err);
    return res.status(500).json({ message: 'Set cover failed' });
  }
};

// ✅ ลบภาพสินค้า (soft delete ใน DB + ลบไฟล์บน Cloudinary)
// รองรับ payload:
// - { imageId: 452 } หรือ { id: 452 }
// - { publicId: "products/..." } หรือ { public_id: "products/..." }
const deleteProductImage = async (req, res) => {
  const productId = toInt(req.params.id);

  // ✅ รองรับ imageId ทั้งจาก params และ body
  const imageId = toInt(req.params?.imageId ?? req.body?.imageId ?? req.body?.id);
  const publicIdRaw = req.body?.publicId ?? req.body?.public_id;

  try {
    if (!productId) return res.status(400).json({ message: 'ไม่พบ productId' });

    // ✅ หา record รูปจาก DB (กันส่ง id/int ไปเทียบกับ public_id)
    const image = await prisma.productImage.findFirst({
      where: {
        productId,
        ...(imageId ? { id: imageId } : {}),
        ...(!imageId && typeof publicIdRaw === 'string' && publicIdRaw ? { public_id: publicIdRaw } : {}),
      },
      select: { id: true, public_id: true, isCover: true, active: true },
    });

    if (!image) return res.status(404).json({ message: 'ไม่พบรูปภาพ' });

    // ✅ ลบที่ Cloudinary ก่อน (ถ้าพัง เราไม่ให้ DB เพี้ยน)
    try {
      if (image.public_id) {
        await cloudinary.uploader.destroy(image.public_id, { resource_type: 'image' });
      }
    } catch (e) {
      console.warn('⚠️ cloudinary destroy failed:', e?.message || e);
      // ไม่ throw เพื่อให้ระบบยังไปต่อได้ (soft delete ใน DB)
    }

    // ✅ soft delete ใน DB + จัดการ cover
    const result = await prisma.$transaction(async (tx) => {
      await tx.productImage.update({
        where: { id: image.id },
        data: { active: false, isCover: false },
      });

      // ถ้ารูปที่ลบเป็น cover → เลือก cover ใหม่ 1 รูปจากรูปที่ยัง active
      if (image.isCover) {
        const nextCover = await tx.productImage.findFirst({
          where: { productId, active: true },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
        if (nextCover) {
          await tx.productImage.update({ where: { id: nextCover.id }, data: { isCover: true } });
        }
      }

      // ส่งรายการรูปที่ยัง active กลับไป (ไว้ให้ FE รีเฟรช UI)
      const images = await tx.productImage.findMany({
        where: { productId, active: true },
        orderBy: [{ isCover: 'desc' }, { createdAt: 'asc' }],
        select: { id: true, url: true, caption: true, isCover: true, public_id: true },
      });

      return images;
    });

    return res.json({ message: 'ลบรูปภาพสำเร็จ', images: result });
  } catch (err) {
    console.error('❌ deleteProductImage error:', err);
    return res.status(500).json({ message: 'Delete image failed' });
  }
};

module.exports = {
  uploadProductImagesOnly,
  uploadAndSaveProductImages,
  deleteProductImage,
  setProductCoverImage,
};




