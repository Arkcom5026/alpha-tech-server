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

  findCustomer(branchId, customerId) {
    return this.prisma.customerProfile.findFirst({
      where: {
        id: Number(customerId),
        repairJobs: { some: { branchId: Number(branchId) } },
      },
      select: { id: true },
    });
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

  async createIntake(data) {
    const rows = await this.prisma.$queryRaw`
      INSERT INTO "DeviceIntake"
        ("intakeNo", "branchId", "customerId", "stockItemId", "purpose", "status", "reportedSymptoms", "createdByEmployeeId", "createdAt", "updatedAt")
      VALUES
        (${data.intakeNo}, ${data.branchId}, ${data.customerId}, ${data.stockItemId}, ${data.purpose}, ${data.status}, ${data.reportedSymptoms}, ${data.createdByEmployeeId}, NOW(), NOW())
      RETURNING "id", "intakeNo", "branchId", "customerId", "stockItemId", "purpose", "status", "reportedSymptoms", "createdByEmployeeId", "createdAt", "updatedAt"
    `;
    return rows[0];
  }

  async createSnapshot(deviceIntakeId, snapshot) {
    const rows = await this.prisma.$queryRaw`
      INSERT INTO "DeviceIntakeSnapshot"
        ("deviceIntakeId", "deviceType", "brand", "model", "serialNumber", "imei", "barcode", "color", "capacity", "specification", "createdAt")
      VALUES
        (${deviceIntakeId}, ${snapshot.deviceType}, ${snapshot.brand}, ${snapshot.model}, ${snapshot.serialNumber}, ${snapshot.imei}, ${snapshot.barcode}, ${snapshot.color}, ${snapshot.capacity}, ${snapshot.specification}, NOW())
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
    const rows = await this.prisma.$queryRaw`
      INSERT INTO "DeviceIntakeAudit"
        ("deviceIntakeId", "action", "actorType", "employeeId", "ipAddress", "userAgent", "metadata", "occurredAt")
      VALUES
        (${deviceIntakeId}, ${audit.action}, ${audit.actorType}, ${audit.employeeId}, ${audit.ipAddress}, ${audit.userAgent}, ${audit.metadata}, NOW())
      RETURNING "id", "action", "actorType", "employeeId", "occurredAt"
    `;
    return rows[0];
  }
}

module.exports = new CreateDeviceIntakeRepository();
module.exports.CreateDeviceIntakeRepository = CreateDeviceIntakeRepository;
