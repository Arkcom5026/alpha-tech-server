const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const walk = (directory) => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'coverage'].includes(entry.name)) return [];
      return walk(absolutePath);
    }
    return [absolutePath];
  });
};

describe('barcode root controller retirement', () => {
  test('legacy root controller is physically removed', () => {
    assert.equal(fs.existsSync(path.join(root, 'controllers/barcodeController.js')), false);
  });

  test('runtime source files do not reference the retired controller', () => {
    const searchableRoots = ['controllers', 'src', 'routes', 'services', 'repositories', 'scripts']
      .map((relativePath) => path.join(root, relativePath))
      .filter((absolutePath) => fs.existsSync(absolutePath));

    const sourceFiles = searchableRoots
      .flatMap(walk)
      .filter((absolutePath) => /\.(c?js|mjs|ts)$/.test(absolutePath));

    const forbiddenPatterns = [
      'controllers/barcodeController',
      'controllers\\barcodeController',
      "require('../../../../../controllers/barcodeController')",
      "require('../controllers/barcodeController')",
    ];

    const violations = sourceFiles.flatMap((absolutePath) => {
      const content = fs.readFileSync(absolutePath, 'utf8');
      return forbiddenPatterns.some((pattern) => content.includes(pattern))
        ? [path.relative(root, absolutePath)]
        : [];
    });

    assert.deepEqual(violations, []);
  });

  test('barcode routes are owned only by vertical slices', () => {
    const routePath = path.join(
      root,
      'src/modules/inventory/barcode/routes/barcodeRoutes.js'
    );
    const route = fs.readFileSync(routePath, 'utf8');

    assert.match(route, /require\('\.\.\/generate\/generateBarcodeController'\)/);
    assert.match(route, /require\('\.\.\/query\/receiptBarcodeQueryController'\)/);
    assert.match(route, /require\('\.\.\/print\/barcodePrintController'\)/);
    assert.match(route, /require\('\.\.\/scan\/barcodeScanController'\)/);
    assert.match(route, /require\('\.\.\/audit\/barcodeAuditController'\)/);
    assert.match(route, /require\('\.\.\/completion\/receiptCompletionController'\)/);
    assert.doesNotMatch(route, /controllers\/barcodeController/);
  });
});
