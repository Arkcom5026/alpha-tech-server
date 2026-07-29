const fs = require('fs');
const path = require('path');

describe('receipt simple module boundary', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

  test('canonical route imports only its module-owned controller', () => {
    const route = read('src/modules/procurement/receipt/simple/routes/receiptSimpleRoutes.js');

    expect(route).toContain("require('../receiptSimpleController')");
    expect(route).not.toContain('controllers/receiptSimpleController');
  });

  test('module controller preserves create and preview contracts', () => {
    const controller = read('src/modules/procurement/receipt/simple/receiptSimpleController.js');

    expect(controller).toContain('const create = (req, res)');
    expect(controller).toContain('const preview = (req, res)');
    expect(controller).toContain('module.exports = { create, preview }');
  });

  test('legacy transaction runtime is explicitly isolated behind the boundary', () => {
    const controller = read('src/modules/procurement/receipt/simple/receiptSimpleController.js');

    expect(controller).toContain("require('../../../../../controllers/receiptSimpleController')");
  });
});
