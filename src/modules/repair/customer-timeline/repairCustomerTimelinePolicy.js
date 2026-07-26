const CUSTOMER_STATUS = Object.freeze({
  RECEIVED: {
    code: 'RECEIVED',
    title: 'ร้านรับอุปกรณ์แล้ว',
    message: 'อุปกรณ์อยู่ในความดูแลของร้านแล้ว',
    stage: 1,
  },
  IN_PROGRESS: {
    code: 'IN_PROGRESS',
    title: 'กำลังตรวจสอบหรือดำเนินการ',
    message: 'ร้านกำลังตรวจสอบและดำเนินการกับอุปกรณ์',
    stage: 2,
  },
  WAITING_PARTS: {
    code: 'WAITING_PARTS',
    title: 'กำลังรออะไหล่',
    message: 'ร้านกำลังจัดเตรียมหรือรออะไหล่สำหรับดำเนินการต่อ',
    stage: 3,
  },
  COMPLETED: {
    code: 'READY',
    title: 'ดำเนินการเสร็จแล้ว',
    message: 'กรุณาติดต่อร้านเพื่อนัดหมายรับอุปกรณ์',
    stage: 4,
  },
  CANCELLED: {
    code: 'CANCELLED',
    title: 'ยุติการดำเนินงาน',
    message: 'งานนี้ถูกยุติแล้ว กรุณาติดต่อร้านหากต้องการข้อมูลเพิ่มเติม',
    stage: 0,
  },
});

function getCustomerStatus(status) {
  return CUSTOMER_STATUS[status] || {
    code: 'IN_PROGRESS',
    title: 'กำลังดำเนินการ',
    message: 'ร้านกำลังดำเนินการกับอุปกรณ์',
    stage: 2,
  };
}

function buildStatusChangedEvent({ repairJobId, fromStatus, toStatus, actor, internalNote }) {
  const projection = getCustomerStatus(toStatus);
  return {
    repairJobId: Number(repairJobId),
    eventType: 'STATUS_CHANGED',
    fromStatus: fromStatus || null,
    toStatus,
    customerVisible: true,
    customerTitle: projection.title,
    customerMessage: projection.message,
    internalNote: internalNote || null,
    performedByEmployeeId: actor?.employeeId || null,
    metadata: {
      customerCode: projection.code,
      customerStage: projection.stage,
    },
  };
}

function buildCustomerTimeline(job, events = []) {
  const current = getCustomerStatus(job.status);
  const receivedEvent = {
    id: `received-${job.id}`,
    eventType: 'RECEIVED',
    code: 'RECEIVED',
    title: CUSTOMER_STATUS.RECEIVED.title,
    message: CUSTOMER_STATUS.RECEIVED.message,
    stage: 1,
    occurredAt: job.createdAt,
    completed: true,
    current: job.status === 'RECEIVED',
  };

  const projectedEvents = events.map((event) => {
    const status = getCustomerStatus(event.toStatus);
    return {
      id: event.id,
      eventType: event.eventType,
      code: event.metadata?.customerCode || status.code,
      title: event.customerTitle || status.title,
      message: event.customerMessage || status.message,
      stage: Number(event.metadata?.customerStage || status.stage),
      occurredAt: event.occurredAt,
      completed: true,
      current: event.toStatus === job.status,
    };
  });

  const timeline = [receivedEvent, ...projectedEvents]
    .sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));

  if (!timeline.some((event) => event.current)) {
    const last = timeline[timeline.length - 1];
    if (last) last.current = true;
  }

  return {
    current: {
      code: current.code,
      label: current.title,
      message: current.message,
      stage: current.stage,
    },
    events: timeline,
  };
}

module.exports = {
  CUSTOMER_STATUS,
  getCustomerStatus,
  buildStatusChangedEvent,
  buildCustomerTimeline,
};
