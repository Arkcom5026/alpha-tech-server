const prisma = require('../../../database/prisma/client');

class IntakeEvidenceRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  findIntake(branchId, repairJobId) {
    return this.prisma.deviceIntake.findFirst({
      where: {
        branchId: Number(branchId),
        repairJobId: Number(repairJobId),
      },
      include: {
        photos: { orderBy: { createdAt: 'asc' } },
        consent: true,
        receivedBy: { select: { id: true, name: true } },
      },
    });
  }

  transaction(work) {
    return this.prisma.$transaction((tx) =>
      work(new IntakeEvidenceRepository(tx))
    );
  }

  upsertConsent(deviceIntakeId, data) {
    return this.prisma.deviceIntakeConsent.upsert({
      where: { deviceIntakeId },
      create: { deviceIntakeId, ...data },
      update: data,
    });
  }

  createPhotos(deviceIntakeId, employeeId, photos) {
    if (!photos.length) return Promise.resolve({ count: 0 });
    return this.prisma.deviceIntakePhoto.createMany({
      data: photos.map((photo) => ({
        deviceIntakeId,
        uploadedByEmployeeId: employeeId,
        url: photo.url,
        storageKey: photo.storageKey,
        category: photo.category,
        caption: photo.caption,
        takenAt: photo.takenAt,
      })),
    });
  }

  createAudit(data) {
    return this.prisma.deviceIntakeAudit.create({ data });
  }
}

module.exports = new IntakeEvidenceRepository();
module.exports.IntakeEvidenceRepository = IntakeEvidenceRepository;
