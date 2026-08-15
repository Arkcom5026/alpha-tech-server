const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const productModule = fs.readFileSync(path.join(root, 'src/modules/product/index.js'), 'utf8');
const uploadRoutes = fs.readFileSync(
  path.join(root, 'src/modules/product/media/routes/uploadProductRoutes.js'),
  'utf8'
);

assert.match(
  productModule,
  /const uploadProductRoutes = require\('\.\/media\/routes\/uploadProductRoutes'\)/,
  'Product module must import product media upload routes'
);

assert.match(
  productModule,
  /app\.use\('\/api\/products', uploadProductRoutes\)/,
  'Product media upload routes must be mounted at the canonical /api/products prefix'
);

assert.match(
  uploadRoutes,
  /router\.post\('\/:id\/images\/upload-full', uploadProductMiddleware\.single\('file'\), uploadAndSaveProductImages\)/,
  'Persisted product image upload endpoint must remain POST /:id/images/upload-full with multipart field file'
);

assert.match(
  uploadRoutes,
  /router\.post\('\/images\/upload', uploadProductMiddleware\.array\('files'\), uploadProductImagesOnly\)/,
  'Temporary product image upload endpoint must remain POST /images/upload with multipart field files'
);

console.log('Product Image Upload Route Alignment Contract: PASS');
