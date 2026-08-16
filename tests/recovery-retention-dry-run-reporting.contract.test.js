'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'recovery', 'retention', 'retentionPolicy.js'),
  'utf8'
);

assert.ok(source.includes('const wouldDelete = [];'));
assert.ok(source.includes('wouldDelete.push({ ...file, dryRun: true });'));
assert.ok(source.includes('fs.unlinkSync(file.filePath);'));
assert.ok(source.includes('wouldDeleteFiles: wouldDelete'));
assert.ok(source.includes('deletedFiles: deleted'));
assert.ok(source.includes('Would delete'));
assert.ok(source.includes('Deleted'));

const dryRunBlock = source.match(/if \(!apply\) \{([\s\S]*?)\n\s*\}/);
assert.ok(dryRunBlock, 'dry-run block must exist');
assert.ok(!dryRunBlock[1].includes('unlinkSync'), 'dry-run must never unlink files');
assert.ok(dryRunBlock[1].includes('wouldDelete.push'), 'dry-run candidates must be reported separately');

console.log('recovery retention dry-run reporting contract: PASS');
