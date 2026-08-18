const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

const tenantSchema = read('prisma/foundation/tenant.prisma');
const migration = read('prisma/migrations/20260817094500_store_document_header_config/migration.sql');
const service = read('src/modules/branch/runtime/branchRuntimeService.js');
const controller = read('src/modules/branch/runtime/branchRuntimeController.js');
const routes = read('src/modules/branch/routes/branchRoutes.js');
const customerReceiptRepository = read('src/modules/customer-money/receive/createCustomerMoneyReceiptRepository.js');
const saleHistoryController = read('src/modules/sales/history/controllers/saleHistoryController.js');
const saleDocumentContract = read('src/modules/sales/documents/contracts/saleDocumentContract.js');

assert.match(tenantSchema, /documentHeaderConfig\s+Json\?/, 'Branch must persist documentHeaderConfig as optional JSON');
assert.match(migration, /ADD COLUMN IF NOT EXISTS "documentHeaderConfig" JSONB/, 'migration must add nullable document header JSONB');
assert.match(service, /normalizeDocumentHeaderConfig/, 'branch runtime must normalize document header configuration');
assert.match(service, /INVALID_DOCUMENT_HEADER_CONFIG/, 'invalid document header payloads must be rejected');
assert.match(service, /documents\[key\] = normalizeHeaderProfile\(profile\)/, 'document-specific overrides must be normalized');
assert.match(service, /DOCUMENT_HEADER_LOGO_SIZE_MIN = 24/, 'custom logo size must have a safe lower bound');
assert.match(service, /DOCUMENT_HEADER_LOGO_SIZE_MAX = 180/, 'custom logo size must allow larger logos up to 180px');
assert.match(service, /DOCUMENT_HEADER_LOGO_SIZE_DEFAULT = 56/, 'custom logo size must preserve the standard 56px default');
assert.match(service, /LEGACY_DOCUMENT_HEADER_LOGO_SIZES/, 'legacy preset values must remain backward compatible');
assert.match(service, /sm: 40, md: 56, lg: 72, xl: 88/, 'legacy presets must map to their original pixel sizes');
assert.match(service, /Math\.min\(DOCUMENT_HEADER_LOGO_SIZE_MAX, Math\.max\(DOCUMENT_HEADER_LOGO_SIZE_MIN/, 'server must clamp custom logo sizes to the safe range');
assert.match(service, /'logoSize'/, 'logo size must be included in the persisted header profile keys');

assert.match(controller, /DOCUMENT_HEADER_BRANCH_SCOPE_DENIED/, 'document header mutation must enforce branch scope');
assert.match(controller, /actorBranchId !== targetBranchId/, 'non-superadmin actors must only mutate their own branch header');
assert.match(controller, /isSuperAdmin/, 'superadmin authority must remain explicit');
assert.match(routes, /router\.put\('\/:id', verifyToken, requireAdmin, updateBranch\)/, 'branch mutation must remain authenticated and admin-only');

assert.match(customerReceiptRepository, /documentHeaderConfig:\s*true/, 'customer money receipt projection must include store document header config');
assert.match(saleHistoryController, /include:\s*SALE_DOCUMENT_INCLUDE/, 'sale detail must use the canonical sale document projection');
assert.match(saleDocumentContract, /branch:\s*\{\s*include:/s, 'canonical sale document projection must include the full branch relation');

console.log('Store Document Header Config Contract: PASS');
