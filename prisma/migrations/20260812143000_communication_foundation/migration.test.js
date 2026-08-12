const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sql = fs.readFileSync(path.join(__dirname, 'migration.sql'), 'utf8');

test('communication foundation is branch-owned and repair-optional', () => {
  assert.match(sql, /CREATE TABLE "CustomerContactChannel"/);
  assert.match(sql, /CREATE TABLE "CommunicationProfile"/);
  assert.match(sql, /CREATE TABLE "RepairCommunicationPreference"/);
  assert.match(sql, /"repairJobId" INTEGER NOT NULL/);
  assert.doesNotMatch(sql, /ALTER TABLE "RepairJob" ADD COLUMN/);
});
