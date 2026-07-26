const repository = require('./devicePassportRepository');

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function toTimeline(intakes, repairs, claims) {
  return [
    ...intakes.map((item) => ({
      type: 'DEVICE_INTAKE',
      referenceId: item.id,
      referenceNo: item.intakeNo,
      title: `รับอุปกรณ์เพื่อ ${item.purpose}`,
      status: item.status,
      occurredAt: item.createdAt,
    })),
    ...repairs.map((item) => ({
      type: 'REPAIR',
      referenceId: item.id,
      referenceNo: item.jobNo,
      title: 'งานซ่อม',
      status: item.status,
      occurredAt: item.createdAt,
    })),
    ...claims.map((item) => ({
      type: 'WARRANTY_CLAIM',
      referenceId: item.id,
      referenceNo: item.claimNo,
      title: 'งานเคลม',
      status: item.status,
      occurredAt: item.openedAt || item.createdAt,
    })),
  ].sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));
}

class DevicePassportService {
  constructor(passportRepository = repository) {
    this.repository = passportRepository;
  }

  async execute(actor, deviceId) {
    const id = Number(deviceId);
    const branchId = Number(actor?.branchId);
    if (!Number.isInteger(id) || id <= 0) {
      throw httpError(400, 'INVALID_DEVICE_ID', 'deviceId ต้องเป็นจำนวนเต็มมากกว่า 0');
    }

    const device = await this.repository.getDevice(branchId, id);
    if (!device) {
      throw httpError(404, 'DEVICE_NOT_FOUND', 'ไม่พบอุปกรณ์ในสาขานี้');
    }

    const [ownershipHistory, intakes, repairs, claims] = await Promise.all([
      this.repository.getOwnershipHistory(id),
      this.repository.getIntakes(id),
      this.repository.getRepairs(id),
      this.repository.getClaims(id),
    ]);

    return {
      contractVersion: 'device-passport.v1',
      device,
      currentOwnerCustomerId: device.currentOwnerCustomerId,
      ownershipHistory,
      lifecycle: {
        intakes,
        repairs,
        claims,
        timeline: toTimeline(intakes, repairs, claims),
      },
    };
  }
}

module.exports = new DevicePassportService();
module.exports.DevicePassportService = DevicePassportService;
module.exports.toTimeline = toTimeline;
