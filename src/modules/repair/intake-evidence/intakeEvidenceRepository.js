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
      select: {
        id: true,
        referenceNo: true,
        receivedAt: true,
        receivedBy: { select: { id: true, name: true } },
        assetDescription: true,
        snapshot: true,
        repairJob: {
          select: {
            id: true, deviceModel: true,
            device: true,
            stockItem: {
              select: {
                id: true, barcode: true, serialNumber: true,
                product: { select: { name: true, brand: { select: { name: true } }, productType: { select: { name: true } } } },
              },
            },
          },
        },
        consent: {
          select: {
            id: true,
            allowDataErase: true,
            allowFactoryReset: true,
            allowDisassembly: true,
            allowOutsourceRepair: true,
            customerSignature: true,
            signedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        photos: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            url: true,
            storageKey: true,
            category: true,
            caption: true,
            uploadedByEmployeeId: true,
            takenAt: true,
            createdAt: true,
          },
        },
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
