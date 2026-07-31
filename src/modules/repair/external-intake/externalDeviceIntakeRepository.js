const prisma = require('../../../database/prisma/client');
const {
  publishDevicePassportEvent,
} = require('../../device/passport/publish/devicePassportEventPublisher');

const repairJobInclude = {
  branch: true,
  customer: { include: { user: true } },
  device: true,
  stockItem: true,
  technician: true,
  partsUsed: { include: { product: true } },
  warrantyClaims: true,
};

const buildCustomerBranchEvidence = (branchId) => ({
  OR: [
    { sale: { some: { branchId } } },
    { repairJobs: { some: { branchId } } },
    { deviceIntakes: { some: { branchId } } },
    { ownedDevices: { some: { branchId, status: { not: 'RETIRED' } } } },
  ],
});

class ExternalDeviceIntakeRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  transaction(work) {
    return this.prisma.$transaction((tx) =>
      work(new ExternalDeviceIntakeRepository(tx))
    );
  }

  findCustomer(branchId, customerId) {
    return this.prisma.customerProfile.findFirst({
      where: {
        id: Number(customerId),
        ...buildCustomerBranchEvidence(Number(branchId)),
      },
      include: { user: true },
    });
  }

  findDeviceByIdentity(branchId, { serialNumber, imei, barcode }) {
    const identity = [];
    if (serialNumber) identity.push({ serialNumber });
    if (imei) identity.push({ imei });
    if (barcode) identity.push({ barcode });
    if (!identity.length) return null;

    return this.prisma.device.findFirst({
      where: {
        branchId: Number(branchId),
        status: { not: 'RETIRED' },
        OR: identity,
      },
    });
  }

  createDevice(data) {
    return this.prisma.device.create({ data });
  }

  createRepairJob(data) {
    return this.prisma.repairJob.create({
      data,
      include: repairJobInclude,
    });
  }

  createDeviceIntake(data) {
    return this.prisma.deviceIntake.create({
      data,
      include: {
        device: true,
        customer: { include: { user: true } },
        accessories: true,
      },
    });
  }

  createOwnership(data) {
    return this.prisma.deviceOwnershipHistory.create({ data });
  }

  publishPassportEvent(event) {
    return publishDevicePassportEvent(this.prisma, event);
  }
}

module.exports = new ExternalDeviceIntakeRepository();
module.exports.ExternalDeviceIntakeRepository = ExternalDeviceIntakeRepository;
module.exports.buildCustomerBranchEvidence = buildCustomerBranchEvidence;
