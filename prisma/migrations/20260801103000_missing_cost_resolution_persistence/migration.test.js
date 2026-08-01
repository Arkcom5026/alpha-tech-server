const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(path.join(__dirname, 'migration.sql'), 'utf8');
const normalized = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

function mustContain(value, message) {
  assert.ok(sql.includes(value), message || `Expected SQL to contain: ${value}`);
}

for (const enumName of [
  'MissingCostResolutionStatus',
  'MissingCostEvidenceSourceType',
  'MissingCostEvidenceConfidence',
  'MissingCostResolutionEventType',
]) {
  mustContain(`CREATE TYPE "${enumName}" AS ENUM`);
}

for (const tableName of [
  'MissingCostResolution',
  'MissingCostResolutionVersion',
  'MissingCostResolutionEvent',
]) {
  mustContain(`CREATE TABLE "${tableName}"`);
}

for (const indexName of [
  'MissingCostResolution_branchId_candidateIdentityHash_key',
  'MissingCostResolution_branchId_candidateId_key',
  'MissingCostResolutionVersion_resolutionId_version_key',
  'MissingCostResolutionVersion_resolutionId_evidenceHash_key',
  'MissingCostResolutionEvent_resolutionId_eventHash_key',
  'MissingCostResolution_branchId_status_idx',
  'MissingCostResolution_branchId_productId_idx',
  'MissingCostResolution_branchId_stockBalanceId_idx',
  'MissingCostResolution_branchId_createdAt_idx',
  'MissingCostResolution_sourceSnapshotHash_idx',
  'MissingCostResolutionVersion_resolutionId_createdAt_idx',
  'MissingCostResolutionEvent_resolutionId_occurredAt_idx',
]) {
  mustContain(`"${indexName}"`);
}

for (const foreignKey of [
  'MissingCostResolution_branchId_fkey',
  'MissingCostResolution_stockBalanceId_fkey',
  'MissingCostResolution_productId_fkey',
  'MissingCostResolution_createdByEmployeeId_fkey',
  'MissingCostResolution_approvedByEmployeeId_fkey',
  'MissingCostResolutionVersion_resolutionId_fkey',
  'MissingCostResolutionVersion_proposerEmployeeId_fkey',
  'MissingCostResolutionVersion_approvedByEmployeeId_fkey',
  'MissingCostResolutionEvent_resolutionId_fkey',
  'MissingCostResolutionEvent_versionId_fkey',
  'MissingCostResolutionEvent_actorEmployeeId_fkey',
]) {
  mustContain(`"${foreignKey}"`);
}

assert.match(sql, /"proposedUnitCost" DECIMAL\(12,2\) NOT NULL/);
assert.doesNotMatch(sql, /"proposedUnitCost"[^,\n]*DEFAULT\s+0/i);
assert.doesNotMatch(normalized, /^\s*DROP\s+(TABLE|COLUMN|TYPE)\b/im);
assert.doesNotMatch(normalized, /ALTER\s+TABLE[\s\S]*?\bDROP\b/i);
assert.doesNotMatch(normalized, /^\s*(DELETE\s+FROM|UPDATE\s+|INSERT\s+INTO)\b/im);
assert.doesNotMatch(normalized, /^\s*(ALTER|DROP)\s+(TABLE|COLUMN|TYPE)\s+"?(SimpleLot|StockMovement|StockBalance)"?\b/im);

console.log('Missing Cost Resolution migration contract: PASS');
