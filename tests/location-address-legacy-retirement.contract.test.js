const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

assert.equal(exists('controllers/addressController.js'), false);
assert.equal(exists('utils/address.js'), false);

const addressRoutes = read('src/modules/location/routes/addressRoutes.js');
const locationsRoutes = read('src/modules/location/routes/locationsRoutes.js');
const resolveService = read('src/modules/location/address/query/resolve/addressResolveService.js');

assert.doesNotMatch(addressRoutes, /controllers\/addressController|addressController/);
assert.doesNotMatch(locationsRoutes, /controllers\/addressController|addressController/);
assert.doesNotMatch(resolveService, /utils\/address|addressUtil/);
assert.match(resolveService, /joinAddressParts/);

const forbiddenRuntimeReferences = [];
const scanRoots = ['src', 'routes', 'controllers', 'services', 'repositories', 'utils'];

function scan(directory) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) return;

  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      scan(relative);
      continue;
    }
    if (!entry.isFile() || !/\.(js|cjs|mjs)$/.test(entry.name)) continue;

    const content = read(relative);
    if (
      /controllers[\\/]addressController/.test(content) ||
      /utils[\\/]address/.test(content) ||
      /addressUtil/.test(content)
    ) {
      forbiddenRuntimeReferences.push(relative);
    }
  }
}

for (const scanRoot of scanRoots) scan(scanRoot);

assert.deepEqual(
  forbiddenRuntimeReferences,
  [],
  `Legacy Address runtime references remain: ${forbiddenRuntimeReferences.join(', ')}`,
);

console.log('location-address-legacy-retirement.contract: PASS');
