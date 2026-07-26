const prisma = require('../../../database/prisma/client');

class DevicePassportEventRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  transaction(work) {
    return this.prisma.$transaction((tx) =>
      work(new DevicePassportEventRepository(tx))
    );
  }

  async createEvent(data) {
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
      RETURNING "id", "deviceId", "branchId", "eventType", "sourceType", "sourceId", "title",
                "description", "actorType", "actorEmployeeId", "customerVisible", "metadata",
                "occurredAt", "createdAt"
    `;
    return rows[0] || null;
  }

  listEvents(deviceId) {
    return this.prisma.$queryRaw`
      SELECT "id", "deviceId", "branchId", "eventType", "sourceType", "sourceId", "title",
             "description", "actorType", "actorEmployeeId", "customerVisible", "metadata",
             "occurredAt", "createdAt"
      FROM "DevicePassportEvent"
      WHERE "deviceId" = ${Number(deviceId)}
      ORDER BY "occurredAt" ASC, "id" ASC
    `;
  }
}

module.exports = new DevicePassportEventRepository();
module.exports.DevicePassportEventRepository = DevicePassportEventRepository;
