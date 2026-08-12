'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'src');
const files = [];
const visit = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(target);
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(target);
  }
};
visit(root);

let checked = 0;
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const calls = source.match(/pg_advisory_xact_lock\([^\n]+,[^\n]+\)/g) || [];
  for (const call of calls) {
    checked += 1;
    assert.match(call, /::int\s*,/, `${path.relative(root, file)} must cast the first lock key to int`);
    assert.match(call, /::int\s*\)/, `${path.relative(root, file)} must cast the second lock key to int`);
  }
  const queryRawLock = /\$queryRaw(?:\(Prisma\.sql)?`[^`]*pg_advisory_xact_lock/.test(source);
  if (queryRawLock) {
    const hidesVoidResult = /SELECT 1::int AS "locked" FROM \(SELECT pg_advisory_xact_lock/.test(source)
      || /WITH lock_state AS MATERIALIZED \([\s\S]*pg_advisory_xact_lock[\s\S]*SELECT 1::int AS "lockAcquired"/.test(source);
    assert.ok(hidesVoidResult, `${path.relative(root, file)} must not deserialize PostgreSQL void`);
  }
}

assert.ok(checked >= 10, 'expected to verify all two-key advisory locks');
console.log(`postgres-advisory-lock-signature.contract: PASS (${checked} locks)`);
