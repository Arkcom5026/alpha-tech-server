const CUSTOMER_STATUS = Object.freeze({
  RECEIVED: Object.freeze({
    code: 'RECEIVED',
    label: 'ร้านรับอุปกรณ์แล้ว',
    description: 'อุปกรณ์อยู่กับร้านและรอการตรวจสอบ',
    stage: 1,
  }),
  IN_PROGRESS: Object.freeze({
    code: 'IN_PROGRESS',
    label: 'กำลังตรวจสอบหรือดำเนินการ',
    description: 'ช่างกำลังตรวจสอบหรือซ่อมอุปกรณ์',
    stage: 2,
  }),
  WAITING_PARTS: Object.freeze({
    code: 'WAITING_PARTS',
    label: 'กำลังรออะไหล่',
    description: 'ร้านกำลังจัดเตรียมหรือรออะไหล่ที่จำเป็น',
    stage: 3,
  }),
  COMPLETED: Object.freeze({
    code: 'READY',
    label: 'ดำเนินการเสร็จแล้ว',
    description: 'กรุณาติดต่อร้านเพื่อรับอุปกรณ์',
    stage: 4,
  }),
  CANCELLED: Object.freeze({
    code: 'CANCELLED',
    label: 'ยุติการดำเนินงาน',
    description: 'รายการนี้ถูกยกเลิกหรือยุติแล้ว',
    stage: 0,
  }),
});

function mapCustomerStatus(status) {
  return CUSTOMER_STATUS[status] || {
    code: 'IN_PROGRESS',
    label: 'กำลังดำเนินการ',
    description: 'กรุณาติดต่อร้านหากต้องการข้อมูลเพิ่มเติม',
    stage: 2,
  };
}

function buildStatusChangedEvent({ repairJobId, fromStatus, toStatus, actor, internalNote }) {
  const projection = mapCustomerStatus(toStatus);

  return {
    repairJobId: Number(repairJobId),
    eventType: 'STATUS_CHANGED',
    fromStatus: fromStatus || null,
    toStatus,
    customerVisible: true,
    customerTitle: projection.label,
    customerMessage: projection.description,
    internalNote: internalNote || null,
    performedByEmployeeId: actor?.employeeId || null,
    metadata: {
      customerCode: projection.code,
      customerStage: projection.stage,
    },
  };
}

function mapPersistedTimelineEvent(event) {
  const projection = mapCustomerStatus(event.toStatus);

  return {
    type: event.eventType,
    title: event.customerTitle || projection.label,
    description: event.customerMessage || projection.description,
    occurredAt: event.occurredAt,
  };
}

module.exports = {
  CUSTOMER_STATUS,
  mapCustomerStatus,
  buildStatusChangedEvent,
  mapPersistedTimelineEvent,
};
