const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REPAIR_ROOT = path.join(ROOT, 'src/modules/repair');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function listJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(absolute);
    return entry.isFile() && entry.name.endsWith('.js') ? [absolute] : [];
  });
}

function relative(absolutePath) {
  return path.relative(ROOT, absolutePath).replace(/\\/g, '/');
}

function assertNotContains(relativePath, forbiddenTokens) {
  const source = read(relativePath);
  for (const token of forbiddenTokens) {
    assert.ok(!source.includes(token), `${relativePath} crosses Repair boundary through forbidden token: ${token}`);
  }
}

function assertContains(relativePath, requiredTokens) {
  const source = read(relativePath);
  for (const token of requiredTokens) {
    assert.ok(source.includes(token), `${relativePath} missing required contract token: ${token}`);
  }
}

function run() {
  const controllerPath = 'src/modules/repair/controllers/repairController.js';
  const routePath = 'src/modules/repair/routes/repairRoutes.js';
  const authorizationPath = 'src/modules/repair/middlewares/repairAuthorization.js';
  const repositoryPath = 'src/modules/repair/repositories/repairRepository.js';
  const errorContractPath = 'src/modules/repair/contracts/repairError.js';

  assertNotContains(controllerPath, [
    "require('../repositories/",
    "require('../../../database/prisma/client')",
    'PrismaClient',
    'prisma.',
  ]);

  assertNotContains(routePath, [
    "require('../services/",
    "require('../repositories/",
    "require('../../../database/prisma/client')",
    'prisma.',
  ]);

  const serviceFiles = listJavaScriptFiles(path.join(REPAIR_ROOT, 'services'));
  assert.ok(serviceFiles.length > 0, 'Repair service layer must contain services');
  for (const file of serviceFiles) {
    const filePath = relative(file);
    assertNotContains(filePath, [
      "require('../controllers/",
      "require('../routes/",
      "require('../middlewares/repairAuthorization')",
    ]);
  }

  assertNotContains(repositoryPath, [
    "require('../controllers/",
    "require('../routes/",
    "require('../services/",
  ]);

  assertContains(authorizationPath, [
    "require('../../../database/prisma/client')",
    'RepairFailureCode.EMPLOYEE_CONTEXT_REQUIRED',
    'RepairFailureCode.FORBIDDEN',
    'Number(employee.branchId) !== tokenBranchId',
    'allowedRoles.has(role)',
  ]);

  assertContains(routePath, [
    'router.use(verifyToken)',
    'router.use(loadRepairEmployeeContext)',
    "const READ_AND_INTAKE_ROLES = ['OWNER', 'MANAGER', 'CASHIER']",
    "const OPERATION_ROLES = ['OWNER', 'MANAGER']",
  ]);

  const routes = read(routePath).split(/\r?\n/).map((line) => line.trim());
  const mutationLines = routes.filter((line) => /^router\.(post|put|patch|delete)\(/.test(line));
  assert.ok(mutationLines.length > 0, 'Repair route layer must expose mutations');
  for (const line of mutationLines) {
    assert.ok(
      line.includes('allowRepairRoles(...OPERATION_ROLES)') ||
        line.includes("router.post('/jobs'") ||
        line.includes("router.post('/jobs/:id/warranty-claims'"),
      `Repair mutation route is missing an approved authority policy: ${line}`,
    );
  }

  assertContains(errorContractPath, [
    "INVALID_INPUT: 'REPAIR_INVALID_INPUT'",
    "FORBIDDEN: 'REPAIR_FORBIDDEN'",
    "REPAIR_JOB_NOT_FOUND: 'REPAIR_JOB_NOT_FOUND'",
    "INVALID_REPAIR_TRANSITION: 'REPAIR_INVALID_TRANSITION'",
    "REPAIR_EXECUTION_AUTHORIZATION_REQUIRED: 'REPAIR_EXECUTION_AUTHORIZATION_REQUIRED'",
    "REPAIR_SETTLEMENT_REQUIRED: 'REPAIR_SETTLEMENT_REQUIRED'",
    "ACTIVE_CLAIM_EXISTS: 'WARRANTY_ACTIVE_CLAIM_EXISTS'",
    "INVALID_CLAIM_TRANSITION: 'WARRANTY_INVALID_TRANSITION'",
    'this.code = code',
    'this.details = details',
  ]);

  const controllerSource = read(controllerPath);
  const serviceRequires = [...controllerSource.matchAll(/require\('\.\.\/services\/([^']+)'\)/g)].map((match) => match[1]);
  assert.ok(serviceRequires.length >= 10, 'Repair controller must delegate to feature services');
  assert.strictEqual(
    new Set(serviceRequires).size,
    serviceRequires.length,
    'Repair controller contains duplicate service dependencies',
  );

  console.log('Repair contract and boundary audit: PASS');
}

run();
