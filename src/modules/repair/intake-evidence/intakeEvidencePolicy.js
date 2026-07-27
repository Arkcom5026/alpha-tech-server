const { RepairError, RepairFailureCode } = require('../contracts/repairError');

function parseBoolean(value) {
  return value === true || value === 'true' || value === '1';
}

function parseConsent(body = {}) {
  const customerSignature = String(body.customerSignature || '').trim();
  const confirmed = parseBoolean(body.confirmed);
  if (confirmed && !customerSignature) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      'กรุณาระบุชื่อผู้ยืนยันการรับเครื่อง',
      400,
      { field: 'customerSignature' }
    );
  }

  return {
    confirmed,
    data: {
      allowDataErase: parseBoolean(body.allowDataErase),
      allowFactoryReset: parseBoolean(body.allowFactoryReset),
      allowDisassembly: parseBoolean(body.allowDisassembly),
      allowOutsourceRepair: parseBoolean(body.allowOutsourceRepair),
      customerSignature: customerSignature || null,
      signedAt: confirmed ? new Date() : null,
    },
  };
}

function mapEvidence(intake) {
  return {
    intakeId: intake.id,
    referenceNo: intake.referenceNo,
    receivedAt: intake.receivedAt,
    receivedBy: intake.receivedBy || null,
    consent: intake.consent || null,
    photos: intake.photos || [],
  };
}

module.exports = { parseBoolean, parseConsent, mapEvidence };
