const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function extractMethod(source, methodName) {
  const startToken = `  async ${methodName}(`;
  const start = source.indexOf(startToken);
  assert.ok(start >= 0, `repairController missing handler: ${methodName}`);

  const next = source.indexOf('\n  async ', start + startToken.length);
  return source.slice(start, next >= 0 ? next : source.indexOf('\n}', start));
}

function requireTokens(source, tokens, label) {
  for (const token of tokens) {
    assert.ok(source.includes(token), `${label} missing API contract token: ${token}`);
  }
}

function run() {
  const routes = read('src/modules/repair/routes/repairRoutes.js');
  const controller = read('src/modules/repair/controllers/repairController.js');
  const errors = read('src/modules/repair/contracts/repairError.js');

  requireTokens(routes, [
    "if (req.method === 'GET')",
    "res.setHeader('Cache-Control', 'no-store')",
    'router.use(verifyToken)',
    'router.use(loadRepairEmployeeContext)',
  ], 'repairRoutes');

  const routeLines = routes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^router\.(get|post|put|patch|delete)\(/.test(line));

  assert.ok(routeLines.length >= 30, 'Repair API surface unexpectedly incomplete');

  const handlerNames = routeLines.map((line) => {
    const match = line.match(/repairController\.([A-Za-z0-9_]+)\);$/);
    assert.ok(match, `Repair route missing controller endpoint: ${line}`);
    return match[1];
  });

  assert.strictEqual(
    new Set(handlerNames).size,
    handlerNames.length,
    'Repair API route handlers must be uniquely exposed',
  );

  for (const handlerName of handlerNames) {
    const block = extractMethod(controller, handlerName);
    requireTokens(block, [
      'resolveRepairActor(req.user)',
      'success: true',
      'data',
      'next(error)',
    ], `repairController.${handlerName}`);
  }

  const createdHandlers = [
    'createJob',
    'recordDiagnosis',
    'createEstimate',
    'recordPayment',
    'addParts',
    'openWarrantyClaim',
  ];
  for (const handlerName of createdHandlers) {
    const block = extractMethod(controller, handlerName);
    assert.ok(block.includes('res.status(201)'), `${handlerName} must return HTTP 201 on creation`);
    assert.ok(block.includes('message:'), `${handlerName} must return an operation message`);
  }

  const idempotentHandlers = [
    'issueRepairWarranty',
    'linkRepeatRepair',
    'issueInvoice',
  ];
  for (const handlerName of idempotentHandlers) {
    const block = extractMethod(controller, handlerName);
    assert.ok(
      block.includes('data.idempotent ? 200 : 201'),
      `${handlerName} must distinguish replay HTTP 200 from initial HTTP 201`,
    );
    assert.ok(block.includes('data.idempotent ?'), `${handlerName} must expose an idempotent response message`);
  }

  const updateHandlers = [
    'updateStatus',
    'recordCompletionChecklist',
    'decideEstimate',
    'handoverToCustomer',
    'reversePartUsage',
    'updateWarrantyClaimStatus',
  ];
  for (const handlerName of updateHandlers) {
    const block = extractMethod(controller, handlerName);
    assert.ok(block.includes('res.status(200)'), `${handlerName} must return HTTP 200`);
    assert.ok(block.includes('message:'), `${handlerName} must return an operation message`);
  }

  const readHandlers = routeLines
    .filter((line) => line.startsWith('router.get('))
    .map((line) => line.match(/repairController\.([A-Za-z0-9_]+)\);$/)[1]);
  for (const handlerName of readHandlers) {
    const block = extractMethod(controller, handlerName);
    assert.ok(block.includes('res.status(200)'), `${handlerName} must return HTTP 200`);
  }

  requireTokens(errors, [
    'class RepairError extends AppError',
    'this.code = code',
    'this.details = details',
    "INVALID_INPUT: 'REPAIR_INVALID_INPUT'",
    "FORBIDDEN: 'REPAIR_FORBIDDEN'",
    "CONFLICT: 'REPAIR_CONFLICT'",
  ], 'repairError');

  const packageJson = JSON.parse(read('package.json'));
  assert.ok(
    packageJson.scripts?.['verify:repair-api-contract-integrity'],
    'package.json missing verify:repair-api-contract-integrity',
  );
  assert.ok(
    packageJson.scripts?.['verify:repair-complete']?.includes('npm run verify:repair-api-contract-integrity'),
    'verify:repair-complete must include API contract integrity audit',
  );

  console.log('Repair API contract integrity audit: PASS');
}

run();