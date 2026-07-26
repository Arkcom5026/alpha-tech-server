import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const routePath = path.join(root, 'routes/stockItemRoutes.js');
const source = fs.readFileSync(routePath, 'utf8');

const importLine = "const { searchSaleCatalog } = require('../src/modules/sales/catalog/controllers/saleCatalogSearchController');";
let next = source;

if (!next.includes(importLine)) {
  const anchor = "} = require('../controllers/stockItemController');";
  if (!next.includes(anchor)) throw new Error('Expected stock item controller import not found');
  next = next.replace(anchor, `${anchor}\n${importLine}`);
}

if (next.includes('router.get(\'/search\', searchStockItem);')) {
  next = next.replace("router.get('/search', searchStockItem);", "router.get('/search', searchSaleCatalog);");
} else if (!next.includes("router.get('/search', searchSaleCatalog);")) {
  throw new Error('Expected stock item search route not found');
}

if (next === source) {
  console.log('Sale catalog search route already wired.');
} else {
  fs.writeFileSync(routePath, next, 'utf8');
  console.log('Sale catalog search route wired successfully.');
}
