'use strict';

const redactMessage = (value) => String(value || '')
  .replace(/postgres(?:ql)?:\/\/[^\s@]+@/gi, 'postgresql://***@')
  .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer ***')
  .slice(0, 2000);

const compactError = (error) => ({
  name: error?.name || 'Error',
  code: error?.code || null,
  message: redactMessage(error?.message || error),
});

const recordIncident = (incidentCode, details = {}) => {
  const event = {
    level: 'error',
    event: 'runtime_incident',
    incidentCode,
    occurredAt: new Date().toISOString(),
    ...details,
  };

  console.error(JSON.stringify(event));
  return event;
};

module.exports = Object.freeze({
  compactError,
  recordIncident,
});
