'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const auditPath = path.join(root, 'docs/architecture/p1-current-tenant-isolation-audit.md');
const contractPath = path.join(
  root,
  'src/modules/access/contracts/currentTenantIsolationAudit.contract.js',
);

const requiredAuditMarkers = [
  '# P1 — Current Tenant Isolation Audit',
  'Runtime behavior change: None',
  'Prisma change: None',
  'Client-provided tenant or branch identifiers are selectors, never authority by themselves.',
  'Cross-tenant access is denied by default.',
  'P1 Step 2 — Tenant Domain Contract',
];

const requiredContractMarkers = [
  'CURRENT_TENANT_ISOLATION_AUDIT_V1',
  "classification: 'REPOSITORY_AUDIT_ONLY'",
  "tenantIdentityAvailable: false",
  "multiBranchMembershipAvailable: false",
  "'CLIENT_IDENTIFIERS_ARE_SELECTORS_NOT_AUTHORITY'",
  "nextStep: 'P1_STEP_2_TENANT_DOMAIN_CONTRACT'",
];

const readRequiredFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required audit file: ${path.relative(root, filePath)}`);
  }
  return fs.readFileSync(filePath, 'utf8');
};

const assertMarkers = (content, markers, label) => {
  const missing = markers.filter((marker) => !content.includes(marker));
  if (missing.length > 0) {
    throw new Error(`${label} is missing required markers: ${missing.join(', ')}`);
  }
};

const audit = readRequiredFile(auditPath);
const contract = readRequiredFile(contractPath);

assertMarkers(audit, requiredAuditMarkers, 'Tenant isolation audit');
assertMarkers(contract, requiredContractMarkers, 'Tenant isolation contract');

const forbiddenPaths = [
  'prisma/schema.prisma',
  'middlewares/verifyToken.js',
  'server.js',
];

for (const relativePath of forbiddenPaths) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    throw new Error(`Expected baseline authority file is missing: ${relativePath}`);
  }
}

console.log('CURRENT_TENANT_ISOLATION_AUDIT_V1: PASS');
