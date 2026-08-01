const { v4: uuidv4 } = require('uuid');
const streamifier = require('streamifier');
const { Prisma } = require('../../../../../lib/prisma');
const { cloudinary } = require('../../../../../utils/cloudinary');
const repository = require('./uploadSlipRuntimeRepository');

const toInt = (value) => (
  value === undefined || value === null || value === ''
    ? undefined
    : Number(value)
);

const uploadBufferToCloudinary = async (file) => {
  const folder = 'payment_slips';
  const publicId = `${folder}/${uuidv4()}`;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        folder,
        resource_type: 'auto',
      },
      (error, uploadResult) => {
        if (error) return reject(error);
        return resolve(uploadResult);
      }
    );

    streamifier.createReadStream(file.buffer).pipe(stream);
  });
};

const uploadAndSaveSlip = async ({ file, body = {}, user = {} }) => {
  if (!file) {
    return {
      status: 400,
      body: { message: 'ไม่พบไฟล์ที่อัปโหลด' },
    };
  }

  const note = String(body.note || '');
  const refType = String(body.refType || '');
  const refId = toInt(body.refId);
  const uploadResult = await uploadBufferToCloudinary(file);

  await repository.createUploadLogIfSupported({
    type: 'SLIP',
    url: uploadResult.secure_url,
    publicId: uploadResult.public_id,
    byUserId: toInt(user.id),
    branchId: toInt(user.branchId),
    note,
    refType: refType || null,
    refId: refId || null,
  });

  return {
    status: 200,
    body: {
      message: 'อัปโหลดสลิปสำเร็จ',
      slip: {
        url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        width: uploadResult.width,
        height: uploadResult.height,
      },
      note,
      refType,
      refId,
    },
  };
};

const deleteSlip = async ({ publicId }) => {
  const normalizedPublicId = String(publicId || '').trim();

  if (!normalizedPublicId) {
    return {
      status: 400,
      body: { message: 'กรุณาระบุ public_id' },
    };
  }

  await cloudinary.uploader.destroy(normalizedPublicId);

  return {
    status: 200,
    body: { message: 'ลบสลิปสำเร็จ' },
  };
};

const isPrismaKnownRequestError = (error) => (
  error instanceof Prisma.PrismaClientKnownRequestError
);

module.exports = {
  uploadAndSaveSlip,
  deleteSlip,
  isPrismaKnownRequestError,
};
