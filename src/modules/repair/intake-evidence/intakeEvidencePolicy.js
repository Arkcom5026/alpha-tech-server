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
  const hasConditionPhoto = (intake?.photos || []).some(
    (photo) => photo.category === 'INTAKE_CONDITION'
  );
  const missingRequirements = [];

  if (!hasConsent) missingRequirements.push('CUSTOMER_CONSENT');

  return {
    complete: missingRequirements.length === 0,
    hasConsent,
    hasConditionPhoto,
    conditionPhotoRequired: false,
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
