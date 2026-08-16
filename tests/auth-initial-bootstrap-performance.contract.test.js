const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const bootstrap = fs.readFileSync(path.join(root, 'src/bootstrap/server.js'), 'utf8');
const repository = fs.readFileSync(
  path.join(root, 'src/modules/auth/session/runtime/sessionAuthRuntimeRepository.js'),
  'utf8'
);

assert.match(bootstrap, /event:\s*'server_started'/, 'server must publish availability before background warm-up');
assert.match(bootstrap, /setImmediate\(warmPrismaInBackground\)/, 'Prisma warm-up must stay off the startup critical path');
assert.match(bootstrap, /prisma\.\$connect\(\)/, 'background warm-up must prime the Prisma pool without mutation');
assert.doesNotMatch(bootstrap, /await\s+warmPrismaInBackground/, 'HTTP startup must never await Prisma warm-up');
assert.match(repository, /AUTH_PERF_TRACE/, 'auth repository timing trace must remain opt-in');
assert.match(repository, /refresh-token\.lookup/, 'refresh token lookup timing must remain observable');
assert.match(repository, /auth\.transaction/, 'refresh rotation transaction timing must remain observable');
assert.match(repository, /session-user\.lookup/, 'session verifier lookup timing must remain observable');

console.log('Auth Initial Bootstrap Performance Contract: PASS');
