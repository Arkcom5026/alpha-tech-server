// controllers/upload/uploadSlipController.js — Prisma singleton, robust upload, optional delete

const { prisma, Prisma } = require('../../lib/prisma');
const { cloudinary } = require('../../utils/cloudinary');
const streamifier = require('streamifier');
const { v4: uuidv4 } = require('uuid');

// 👉 Helper
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));

// POST /api/slips/upload
const uploadAndSaveSlip = async (req, res) => {
  try {
    // ใช้ prisma ให้สอดคล้องทั้งระบบ (กัน ESLint no-unused-vars ด้วย log เบา ๆ)
    console.log('🔌 prisma ready:', !!prisma);

    const file = req.file;
    const note = (req.body?.note || '').toString();
    const refType = (req.body?.refType || '').toString(); // ตัวอย่าง: 'supplierPayment' | 'salePayment' | 'expense'
    const refId = toInt(req.body?.refId);

    if (!file) {
      return res.status(400).json({ message: 'ไม่พบไฟล์ที่อัปโหลด' });
    }

    const folder = 'payment_slips';
    const publicId = `${folder}/${uuidv4()}`;

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          folder,
          resource_type: 'auto', // ✅ รองรับทั้งรูปและ PDF
        },
        (error, uploadResult) => {
          if (error) {
            console.error('❌ Cloudinary error:', error);
            return reject(error);
          }
          resolve(uploadResult);
        }
      );
      streamifier.createReadStream(file.buffer).pipe(stream);
    });

    // (ออปชัน) จะบันทึกลง DB ก็ทำได้ ถ้ามีโมเดลรองรับ เช่น uploadLog/paymentSlip
    // ป้องกัน schema ไม่ตรงด้วยการเช็คอย่างปลอดภัย
    try {
      const byUserId = toInt(req.user?.id);
      const branchId = toInt(req.user?.branchId);
      if (prisma.uploadLog && typeof prisma.uploadLog.create === 'function') {
        await prisma.uploadLog.create({
          data: {
            type: 'SLIP',
            url: result.secure_url,
            publicId: result.public_id,
            byUserId,
            branchId,
            note,
            refType: refType || null,
            refId: refId || null,
          },
        });
      }
    } catch (e) {
      // ถ้าไม่มีโมเดลนี้ ให้ข้ามไป (best-effort logging เท่านั้น)
      console.warn('⚠️ DB log skipped:', e?.code || e?.message);
    }

    return res.json({
      message: 'อัปโหลดสลิปสำเร็จ',
      slip: {
        url: result.secure_url,
        public_id: result.public_id,
        bytes: result.bytes,
        format: result.format,
        width: result.width,
        height: result.height,
      },
      note,
      refType,
      refId,
    });
  } catch (err) {
    console.error('❌ uploadAndSaveSlip error:', err);
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return res.status(400).json({ message: 'เกิดข้อผิดพลาดฐานข้อมูล', code: err.code });
    }
    return res.status(500).json({ message: 'Upload slip failed' });
  }
};

// DELETE /api/slips
// body: { public_id: string }
const deleteSlip = async (req, res) => {
  try {
    const public_id = (req.body?.public_id || '').toString().trim();
    if (!public_id) return res.status(400).json({ message: 'กรุณาระบุ public_id' });

    await cloudinary.uploader.destroy(public_id);
    return res.json({ message: 'ลบสลิปสำเร็จ' });
  } catch (err) {
    console.error('❌ deleteSlip error:', err);
    return res.status(500).json({ message: 'ลบสลิปไม่สำเร็จ' });
  }
};

module.exports = { uploadAndSaveSlip, deleteSlip };
