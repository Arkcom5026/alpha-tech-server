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

assert.match(source, /AUTH_PERF_TRACE === '1'/, 'auth performance trace must remain opt-in');
assert.match(source, /refresh-token\.lookup/, 'refresh lookup timing must be observable');
assert.match(source, /refresh-token\.create/, 'refresh token creation timing must be observable');
assert.match(source, /refresh-token\.update/, 'refresh token rotation update timing must be observable');
assert.match(source, /auth\.transaction/, 'auth transaction timing must be observable');
assert.match(source, /session-user\.lookup/, 'auth me/session lookup timing must be observable');
assert.doesNotMatch(source, /tokenHash.*console\.(?:log|info|warn|error)/, 'auth timing logs must not expose token hashes');

console.log('Auth refresh-token repository contract: PASS');
