const SOURCE_DIRECTION = Object.freeze({
  SALE: 'OUTPUT',
  SALE_RETURN: 'OUTPUT',
  PURCHASE_RECEIPT: 'INPUT',
  REPAIR_JOB: 'OUTPUT',
  EXPENSE: 'INPUT',
});

const expectedTaxDirection = (sourceType) =>
  SOURCE_DIRECTION[String(sourceType || '').trim().toUpperCase()] || null;

const assertTaxAuthorityBoundary = ({ sourceType, direction }) => {
  const expected = expectedTaxDirection(sourceType);
  if (!expected) throw new TypeError(`Unsupported tax source type: ${sourceType}`);
  if (String(direction || '').trim().toUpperCase() !== expected) {
    throw new TypeError(`${sourceType} must produce ${expected} tax evidence`);
  }
  return true;
};

module.exports = {
  SOURCE_DIRECTION,
  expectedTaxDirection,
  assertTaxAuthorityBoundary,
};
