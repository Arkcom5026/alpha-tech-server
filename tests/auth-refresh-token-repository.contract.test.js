const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryPath = path.join(
  __dirname,
  '..',
  'src',
  'modules',
  'auth',
  'session',
  'runtime',
  'sessionAuthRuntimeRepository.js'
);
const source = fs.readFileSync(repositoryPath, 'utf8');

const lookupStart = source.indexOf('const findRefreshTokenByHash');
const lookupEnd = source.indexOf('const findRefreshTokenChildren', lookupStart);
const lookup = source.slice(lookupStart, lookupEnd);

assert.match(lookup, /prisma\.refreshToken\.findFirst\(/);
assert.doesNotMatch(lookup, /prisma\.refreshToken\.findUnique\(/);

console.log('Auth refresh-token repository contract: PASS');
