const fs = require('fs');
const path = require('path');

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
    expect(fs.existsSync(path.join(root, 'controllers/barcodeController.js'))).toBe(false);
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

    expect(violations).toEqual([]);
  });

  test('barcode routes are owned only by vertical slices', () => {
    const routePath = path.join(
      root,
      'src/modules/inventory/barcode/routes/barcodeRoutes.js'
    );
    const route = fs.readFileSync(routePath, 'utf8');

    expect(route).toContain("require('../generate/generateBarcodeController')");
    expect(route).toContain("require('../query/receiptBarcodeQueryController')");
    expect(route).toContain("require('../print/barcodePrintController')");
    expect(route).toContain("require('../scan/barcodeScanController')");
    expect(route).toContain("require('../audit/barcodeAuditController')");
    expect(route).toContain("require('../completion/receiptCompletionController')");
    expect(route).not.toContain('controllers/barcodeController');
  });
});
