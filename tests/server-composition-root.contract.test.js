'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { compositionFiles } = require('../scripts/read-server-composition-source');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const entrypoint = read('server.js');
assert.match(entrypoint, /require\('\.\/src\/bootstrap\/createApp'\)/);
assert.match(entrypoint, /module\.exports = createApp\(\)/);
assert.doesNotMatch(entrypoint, /app\.use\(/);

const createApp = read('src/bootstrap/createApp.js');
const middlewareIndex = createApp.indexOf('registerCoreMiddleware(app)');
const routesIndex = createApp.indexOf('registerRoutes(app)');
const errorsIndex = createApp.indexOf('registerErrorHandlers(app)');
assert(middlewareIndex >= 0 && middlewareIndex < routesIndex);
assert(routesIndex < errorsIndex);

const routeFiles = compositionFiles.filter((file) => (
  file.startsWith('src/bootstrap/routes/register')
  && file !== 'src/bootstrap/routes/registerRoutes.js'
));
const routeSource = routeFiles.map(read).join('\n');
const routeMounts = routeSource.match(/app\.use\('\/api\//g) || [];
assert.strictEqual(routeMounts.length, 70, 'all 70 explicit API mounts must remain registered');
assert.match(routeSource, /mountProductModule\(app\)/);

console.log('Server composition root contract: PASS');
