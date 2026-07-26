const TAX_SOURCE_TYPES = Object.freeze([
  'SALE',
  'SALE_RETURN',
  'PURCHASE_RECEIPT',
  'REPAIR_JOB',
  'EXPENSE',
]);

const TAX_DIRECTIONS = Object.freeze(['OUTPUT', 'INPUT']);

const assertEnum = (value, allowed, field) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!allowed.includes(normalized)) {
    throw new TypeError(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return normalized;
};

const assertId = (value, field) => {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${field} is required`);
  return normalized;
};

const parseTaxCandidateIdentity = (input = {}) => Object.freeze({
  sourceType: assertEnum(input.sourceType, TAX_SOURCE_TYPES, 'sourceType'),
  sourceId: assertId(input.sourceId, 'sourceId'),
  direction: assertEnum(input.direction, TAX_DIRECTIONS, 'direction'),
  branchId: input.branchId == null ? null : assertId(input.branchId, 'branchId'),
});

module.exports = {
  TAX_SOURCE_TYPES,
  TAX_DIRECTIONS,
  parseTaxCandidateIdentity,
};
