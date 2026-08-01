const { prisma } = require('../../../../../lib/prisma');

const createUploadLogIfSupported = async ({
  url,
  publicId,
  byUserId,
  branchId,
  note,
  refType,
  refId,
}) => {
  if (!prisma.uploadLog || typeof prisma.uploadLog.create !== 'function') {
    return null;
  }

  return prisma.uploadLog.create({
    data: {
      type: 'SLIP',
      url,
      publicId,
      byUserId,
      branchId,
      note,
      refType: refType || null,
      refId: refId || null,
    },
  });
};

module.exports = {
  createUploadLogIfSupported,
};
