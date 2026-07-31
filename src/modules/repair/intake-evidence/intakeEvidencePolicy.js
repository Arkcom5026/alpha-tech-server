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

function evaluateIntakeCompletion(intake) {
  const hasConsent = Boolean(
    intake?.consent?.customerSignature && intake?.consent?.signedAt
  );
  const photoCount = Array.isArray(intake?.photos) ? intake.photos.length : 0;
  const hasConditionPhoto = photoCount > 0;
  const missingRequirements = [];

  if (!hasConsent) missingRequirements.push('CUSTOMER_CONSENT');
  if (!hasConditionPhoto) missingRequirements.push('INTAKE_PHOTO');

  return {
    complete: missingRequirements.length === 0,
    hasConsent,
    hasConditionPhoto,
    photoCount,
    missingRequirements,
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
    completion: evaluateIntakeCompletion(intake),
  };
}

module.exports = {
  parseBoolean,
  parseConsent,
  evaluateIntakeCompletion,
  mapEvidence,
};
