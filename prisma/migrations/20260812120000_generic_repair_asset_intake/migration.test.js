const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('node:fs'); const path = require('node:path');
const sql = fs.readFileSync(path.join(__dirname, 'migration.sql'), 'utf8');
test('generic intake makes device optional', () => { assert.match(sql, /assetDescription/); assert.match(sql, /deviceId" DROP NOT NULL/); });
