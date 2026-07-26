const prisma = require('../../../database/prisma/client');

class CreateDeviceIntakeRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  transaction(work) {
    return this.prisma.$transaction((tx) =>
      work(new CreateDeviceIntakeRepository(tx))
    );
  }

  findCustomerById(customerId) {
    return this.prisma.customerProfile.findUnique({
      where: { id: Number(customerId) },
      select: { id: true },
    });
  }

  findStockItem(branchId, stockItemId) {
    return this.prisma.stockItem.findFirst({
      where: { id: Number(stockItemId), branchId: Number(branchId) },
      select: {
        id: true,
        barcode: true,
        serialNumber: true,
        product: {
          select: {
            name: true,
            brand: { select: { name: true } },
            productType: { select: { name: true } },
          },
        },
      },
    });
  }

  async findDevice({ stockItemId, fingerprint }) {
    const rows = await this.prisma.$queryRaw`
      SELECT "id", "branchId", "currentOwnerCustomerId", "stockItemId", "fingerprint",
             "deviceType", "brand", "model", "serialNumber", "imei", "barcode", "status",
             "createdAt", "updatedAt"
      FROM "Device"
      WHERE (${stockItemId}::INTEGER IS NOT NULL AND "stockItemId" = ${stockItemId})
         OR "fingerprint" = ${fingerprint}
      ORDER BY CASE WHEN "stockItemId" = ${stockItemId} THEN 0 ELSE 1 END
      LIMIT 1
    `;
    return rows[0] || null;
  }

  async createDevice(data) {
    const rows = await this.prisma.$queryRaw`
      INSERT INTO "Device"
        ("branchId", "currentOwnerCustomerId", "stockItemId", "fingerprint", "deviceType", "brand", "model", "serialNumber", "imei", "barcode", "status", "createdAt", "updatedAt")
      VALUES
        (${data.branchId}, ${data.customerId}, ${data.stockItemId}, ${data.fingerprint}, ${data.deviceType}, ${data.brand}, ${data.model}, ${data.serialNumber}, ${data.imei}, ${data.barcode}, 'ACTIVE', NOW(), NOW())
      RETURNING *
    `;
    return rows[0];
  }

  async updateDeviceIdentity(deviceId, data) {
    const rows = await this.prisma.$queryRaw`
      UPDATE "Device"
      SET "currentOwnerCustomerId" = ${data.customerId},
          "deviceType" = COALESCE(${data.deviceType}, "deviceType"),
          "brand" = COALESCE(${data.brand}, "brand"),
          "model" = COALESCE(${data.model}, "model"),
          "serialNumber" = COALESCE(${data.serialNumber}, "serialNumber"),
          "imei" = COALESCE(${data.imei}, "imei"),
          "barcode" = COALESCE(${data.barcode}, "barcode"),
          "updatedAt" = NOW()
      WHERE "id" = ${Number(deviceId)}
      RETURNING *
    `;
    return rows[0];
  }

  async ensureOwnership(deviceId, customerId, employeeId) {
    const activeRows = await this.prisma.$queryRaw`
      SELECT "id", "customerId"
      FROM "DeviceOwnershipHistory"
      WHERE "deviceId" = ${Number(deviceId)} AND "endedAt" IS NULL
      ORDER BY "startedAt" DESC
      LIMIT 1
    `;
    const active = activeRows[0] || null;
    if (active && Number(active.customerId) === Number(customerId)) return active;

    if (active) {
      await this.prisma.$executeRaw`
        UPDATE "DeviceOwnershipHistory"
        SET "endedAt" = NOW()
        WHERE "id" = ${Number(active.id)}
      `;
    }

    const rows = await this.prisma.$queryRaw`
      INSERT INTO "DeviceOwnershipHistory"
        ("deviceId", "customerId", "ownershipType", "sourceType", "createdByEmployeeId", "startedAt", "createdAt")
      VALUES
        (${Number(deviceId)}, ${Number(customerId)}, 'CUSTOMER', 'DEVICE_INTAKE', ${Number(employeeId)}, NOW(), NOW())
      RETURNING *
    `;
    return rows[0];
  }

  async createPassportEvent(data) {
    const metadata = data.metadata ? JSON.stringify(data.metadata) : null;
    const rows = await this.prisma.$queryRaw`
      INSERT INTO "DevicePassportEvent"
        ("deviceId", "branchId", "eventType", "sourceType", "sourceId", "title", "description",
         "actorType", "actorEmployeeId", "customerVisible", "metadata", "occurredAt", "createdAt")
      VALUES
        (${data.deviceId}, ${data.branchId}, ${data.eventType}, ${data.sourceType}, ${data.sourceId},
         ${data.title}, ${data.description}, ${data.actorType}, ${data.actorEmployeeId},
         ${data.customerVisible}, ${metadata}::jsonb, ${data.occurredAt}, NOW())
      ON CONFLICT DO NOTHING
      RETURNING *
    `;
    return rows[0] || null;
  }

  async createIntake(data) {
    const rows = await this.prisma.$queryRaw`
      INSERT INTO "DeviceIntake"
        ("intakeNo", "deviceId", "branchId", "customerId", "stockItemId", "purpose", "status", "reportedSymptoms", "createdByEmployeeId", "createdAt", "updatedAt")
      VALUES
        (${data.intakeNo}, ${data.deviceId}, ${data.branchId}, ${data.customerId}, ${data.stockItemId}, ${data.purpose}, ${data.status}, ${data.reportedSymptoms}, ${data.createdByEmployeeId}, NOW(), NOW())
      RETURNING "id", "intakeNo", "deviceId", "branchId", "customerId", "stockItemId", "purpose", "status", "reportedSymptoms", "createdByEmployeeId", "createdAt", "updatedAt"
    `;
    return rows[0];
  }

  async createSnapshot(deviceIntakeId, snapshot) {
    const specification = snapshot.specification
      ? JSON.stringify(snapshot.specification)
      : null;
    const rows = await this.prisma.$queryRaw`
      INSERT INTO "DeviceIntakeSnapshot"
        ("deviceIntakeId", "deviceType", "brand", "model", "serialNumber", "imei", "barcode", "color", "capacity", "specification", "createdAt")
      VALUES
        (${deviceIntakeId}, ${snapshot.deviceType}, ${snapshot.brand}, ${snapshot.model}, ${snapshot.serialNumber}, ${snapshot.imei}, ${snapshot.barcode}, ${snapshot.color}, ${snapshot.capacity}, ${specification}::jsonb, NOW())
      RETURNING *
    `;
    return rows[0];
  }

  async createCondition(deviceIntakeId, condition) {
    const rows = await this.prisma.$queryRaw`
      INSERT INTO "DeviceIntakeCondition"
        ("deviceIntakeId", "screenCrack", "housingDamage", "scratch", "waterDamage", "missingScrews", "missingParts", "overallCondition", "remark", "createdAt", "updatedAt")
      VALUES
        (${deviceIntakeId}, ${condition.screenCrack}, ${condition.housingDamage}, ${condition.scratch}, ${condition.waterDamage}, ${condition.missingScrews}, ${condition.missingParts}, ${condition.overallCondition}, ${condition.remark}, NOW(), NOW())
      RETURNING *
    `;
    return rows[0];
  }

  async createAccessories(deviceIntakeId, accessories) {
    const created = [];
    for (const accessory of accessories) {
      const rows = await this.prisma.$queryRaw`
        INSERT INTO "DeviceIntakeAccessory"
          ("deviceIntakeId", "type", "description", "quantity", "createdAt")
        VALUES
          (${deviceIntakeId}, ${accessory.type}, ${accessory.description}, ${accessory.quantity}, NOW())
        RETURNING *
      `;
      created.push(rows[0]);
    }
    return created;
  }

  async createConsent(deviceIntakeId, consent) {
    const rows = await this.prisma.$queryRaw`
      INSERT INTO "DeviceIntakeConsent"
        ("deviceIntakeId", "allowDisassembly", "allowDataReset", "allowBackup", "allowNotifications", "allowTracking", "allowWarrantyCheck", "agreedTerms", "termsVersion", "agreedAt", "createdAt", "updatedAt")
      VALUES
        (${deviceIntakeId}, ${consent.allowDisassembly}, ${consent.allowDataReset}, ${consent.allowBackup}, ${consent.allowNotifications}, ${consent.allowTracking}, ${consent.allowWarrantyCheck}, ${consent.agreedTerms}, ${consent.termsVersion}, ${consent.agreedAt}, NOW(), NOW())
      RETURNING *
    `;
    return rows[0];
  }

  async createAudit(deviceIntakeId, audit) {
    const metadata = audit.metadata ? JSON.stringify(audit.metadata) : null;
    const rows = await this.prisma.$queryRaw`
      INSERT INTO "DeviceIntakeAudit"
        ("deviceIntakeId", "action", "actorType", "employeeId", "ipAddress", "userAgent", "metadata", "occurredAt")
      VALUES
        (${deviceIntakeId}, ${audit.action}, ${audit.actorType}, ${audit.employeeId}, ${audit.ipAddress}, ${audit.userAgent}, ${metadata}::jsonb, NOW())
      RETURNING "id", "action", "actorType", "employeeId", "occurredAt"
    `;
    return rows[0];
  }
}

module.exports = new CreateDeviceIntakeRepository();
module.exports.CreateDeviceIntakeRepository = CreateDeviceIntakeRepository;
