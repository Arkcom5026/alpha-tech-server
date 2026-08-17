const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

const tenantSchema = read('prisma/foundation/tenant.prisma');
const migration = read('prisma/migrations/20260817094500_store_document_header_config/migration.sql');
const service = read('src/modules/branch/runtime/branchRuntimeService.js');
const controller = read('src/modules/branch/runtime/branchRuntimeController.js');
const routes = read('src/modules/branch/routes/branchRoutes.js');

assert.match(
  tenantSchema,
  /documentHeaderConfig\s+Json\?/,
  'Branch must persist documentHeaderConfig as an optional JSON field',
);
assert.match(
  migration,
  /ADD COLUMN IF NOT EXISTS "documentHeaderConfig" JSONB/,
  'migration must add the nullable JSONB authority column',
);
assert.match(
  service,
  /normalizeDocumentHeaderConfig/,
  'branch runtime must normalize document header configuration',
);
assert.match(
  service,
  /INVALID_DOCUMENT_HEADER_CONFIG/,
  'invalid document header payloads must be rejected',
);
assert.match(
  service,
  /documents\[key\] = normalizeHeaderProfile\(profile\)/,
  'document-specific overrides must be normalized',
);
assert.match(
  controller,
  /DOCUMENT_HEADER_BRANCH_SCOPE_DENIED/,
  'document header mutation must enforce branch scope',
);
assert.match(
  controller,
  /actorBranchId !== targetBranchId/,
  'non-superadmin actors must only mutate their own branch header',
);
assert.match(
  controller,
  /isSuperAdmin/,
  'superadmin authority must remain explicit',
);
assert.match(
  routes,
  /router\.put\('\/:id', verifyToken, requireAdmin, updateBranch\)/,
  'branch mutation must remain authenticated and admin-only',
);

console.log('Store Document Header Config Contract: PASS');
