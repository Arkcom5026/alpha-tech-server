const prisma = require('../../../../database/prisma/client');

class DevicePassportRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  async getDevice(branchId, deviceId) {
    const rows = await this.prisma.$queryRaw`
      SELECT "id", "branchId", "currentOwnerCustomerId", "stockItemId", "fingerprint",
             "deviceType", "brand", "model", "serialNumber", "imei", "barcode", "status",
             "createdAt", "updatedAt"
      FROM "Device"
      WHERE "id" = ${Number(deviceId)} AND "branchId" = ${Number(branchId)}
      LIMIT 1
    `;
    return rows[0] || null;
  }

  getOwnershipHistory(deviceId) {
    return this.prisma.$queryRaw`
      SELECT "id", "customerId", "ownershipType", "startedAt", "endedAt", "sourceType", "sourceId", "createdAt"
      FROM "DeviceOwnershipHistory"
      WHERE "deviceId" = ${Number(deviceId)}
      ORDER BY "startedAt" ASC, "id" ASC
    `;
  }

  getIntakes(deviceId) {
    return this.prisma.$queryRaw`
      SELECT "id", "intakeNo", "purpose", "status", "reportedSymptoms", "createdAt", "updatedAt"
      FROM "DeviceIntake"
      WHERE "deviceId" = ${Number(deviceId)}
      ORDER BY "createdAt" ASC, "id" ASC
    `;
  }

  getRepairs(deviceId) {
    return this.prisma.$queryRaw`
      SELECT "id", "jobNo", "status", "reportedSymptoms", "createdAt", "updatedAt"
      FROM "RepairJob"
      WHERE "deviceId" = ${Number(deviceId)}
      ORDER BY "createdAt" ASC, "id" ASC
    `;
  }

  getClaims(deviceId) {
    return this.prisma.$queryRaw`
      SELECT "id", "claimNo", "status", "reason", "openedAt", "resolvedAt", "createdAt", "updatedAt"
      FROM "WarrantyClaim"
      WHERE "deviceId" = ${Number(deviceId)}
      ORDER BY "openedAt" ASC, "id" ASC
    `;
  }
}

module.exports = new DevicePassportRepository();
module.exports.DevicePassportRepository = DevicePassportRepository;
