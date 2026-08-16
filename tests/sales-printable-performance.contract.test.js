const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const controllerPath = path.join(root, 'src/modules/sales/history/controllers/saleHistoryController.js');
const routesPath = path.join(root, 'src/modules/sales/routes/saleRoutes.js');

const controller = fs.readFileSync(controllerPath, 'utf8');
const routes = fs.readFileSync(routesPath, 'utf8');

const printableStart = controller.indexOf('const searchPrintableSales = async');
const printableEnd = controller.indexOf('const getAllSalesReturn = getAllSales;');
assert.ok(printableStart >= 0 && printableEnd > printableStart, 'printable controller block must exist');

const printableBlock = controller.slice(printableStart, printableEnd);

assert.match(controller, /const SALE_PRINTABLE_SELECT = \{/);
assert.match(printableBlock, /select: SALE_PRINTABLE_SELECT/);
assert.doesNotMatch(printableBlock, /include: SALE_DOCUMENT_INCLUDE/);
assert.match(controller, /customer:\s*\{\s*select:/s);
assert.match(controller, /employee:\s*\{\s*select:\s*\{\s*name:\s*true/s);
assert.match(printableBlock, /await Promise\.all\(\[/);
assert.match(printableBlock, /prisma\.taxCandidate\.findMany/);
assert.match(printableBlock, /prisma\.payment\.findMany/);

assert.match(routes, /router\.get\('\/printable', searchPrintableSales\)/);
assert.match(routes, /router\.get\('\/printable-sales', searchPrintableSales\)/);

console.log('Sales printable performance contract: PASS');
