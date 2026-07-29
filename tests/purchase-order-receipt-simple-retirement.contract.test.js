const fs = require('fs');
const path = require('path');

describe('purchase order receipt simple legacy retirement', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
  const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

  test('server does not mount the misnamed root route', () => {
    const server = read('server.js');

    expect(server).not.toContain("require('./routes/purchaseOrderReceiptSimpleRoutes')");
    expect(server).not.toContain("app.use('/api/purchase-order-receipts-simple'");
  });

  test('misnamed root route stays retired', () => {
    expect(exists('routes/purchaseOrderReceiptSimpleRoutes.js')).toBe(false);
  });

  test('canonical simple receipt module remains mounted', () => {
    const server = read('server.js');
    const canonicalRoute = read(
      'src/modules/procurement/receipt/simple/routes/receiptSimpleRoutes.js',
    );

    expect(server).toContain(
      "require('./src/modules/procurement/receipt/simple/routes/receiptSimpleRoutes')",
    );
    expect(server).toContain("app.use('/api/receipts-simple', receiptSimpleRoutes)");
    expect(canonicalRoute).toContain("router.post('/preview', preview)");
    expect(canonicalRoute).toContain("router.post('/', create)");
  });

  test('employee routes remain owned only by the employee module', () => {
    const server = read('server.js');
    const employeeRoutes = read('src/modules/employee/routes/employeeRoutes.js');

    expect(server).toContain("app.use('/api/employees', employeeRoutes)");
    expect(employeeRoutes).toContain("router.get('/', getAllEmployees)");
    expect(employeeRoutes).toContain("router.post('/', createEmployeeController)");
  });
});