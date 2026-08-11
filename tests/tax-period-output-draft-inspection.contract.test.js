const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const inspectorSource = fs.readFileSync(
  path.join(root, 'scripts', 'inspect-tax-period-output-drafts.js'),
  'utf8',
);
const periodServiceSource = fs.readFileSync(
  path.join(root, 'src', 'modules', 'tax', 'periods', 'taxPeriodService.js'),
  'utf8',
);

test('period output draft inspector mirrors the close-period draft authority scope', () => {
  for (const expected of [
    "documentType: 'OUTPUT_TAX_INVOICE'",
    "status: 'DRAFT'",
    'gte: period.startDate',
    'lte: period.endDate',
  ]) {
    assert.match(inspectorSource, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(periodServiceSource, /documentType:\s*'OUTPUT_TAX_INVOICE'/);
  assert.match(periodServiceSource, /status:\s*'DRAFT'/);
  assert.match(periodServiceSource, /occurredAt:\s*\{\s*gte:\s*current\.startDate,\s*lte:\s*current\.endDate\s*\}/s);
});

test('period output draft inspector is read-only and exposes candidate context', () => {
  assert.doesNotMatch(inspectorSource, /\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\s*\(/);
  assert.match(inspectorSource, /prisma\.taxPeriod\.findFirst/);
  assert.match(inspectorSource, /prisma\.taxDocument\.findMany/);
  assert.match(inspectorSource, /sourceType:\s*true/);
  assert.match(inspectorSource, /sourceId:\s*true/);
  assert.match(inspectorSource, /sourceDocumentNo:\s*true/);
  assert.match(inspectorSource, /COUNT = \$\{documents\.length\}/);
});
