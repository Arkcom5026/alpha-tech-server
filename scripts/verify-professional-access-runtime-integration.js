'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const files = [
  'src/modules/professional-access/index.js',
  'src/modules/professional-access/contracts/professionalAccess.contract.js',
  'src/modules/professional-access/routes/professionalAccessRoutes.js',
  'src/modules/professional-access/accountant-workspace/accountantWorkspaceRoutes.js',
  'src/modules/professional-access/tax-review-collaboration/taxReviewRoutes.js',
  'server.js',
];

for (const file of files) {
  expect(fs.existsSync(path.join(root, file)), `Missing ${file}`);
}

const moduleIndex = read(files[0]);
const contract = require(path.join(root, files[1]));
const aggregateRoutes = read(files[2]);
const workspaceRoutes = read(files[3]);
const taxReviewRoutes = read(files[4]);
const server = read(files[5]);

expect(
  contract.PROFESSIONAL_ACCESS_BASE_PATH === '/api/professional-access',
  'Professional Access public base path must remain /api/professional-access',
);
expect(
  moduleIndex.includes("require('./contracts/professionalAccess.contract')"),
  'Professional Access module must import its public contract',
);
expect(
  moduleIndex.includes(
    'app.use(professionalAccessContract.PROFESSIONAL_ACCESS_BASE_PATH, professionalAccessRoutes)',
  ),
  'Professional Access module must mount through the contract-owned base path',
);
expect(
  moduleIndex.includes('mountProfessionalAccessModule'),
  'Professional Access module must export its mount function',
);
expect(aggregateRoutes.includes('accountantWorkspaceRoutes'), 'Aggregator must include accountant workspace routes');
expect(aggregateRoutes.includes('taxReviewRoutes'), 'Aggregator must include tax review routes');
expect(workspaceRoutes.includes('router.use(verifyToken)'), 'Workspace routes must remain authenticated');
expect(taxReviewRoutes.includes('router.use(verifyToken)'), 'Tax review routes must remain authenticated');
expect(server.includes("require('./src/modules/professional-access')"), 'Server must import professional access module');
expect(server.includes('mountProfessionalAccessModule(app);'), 'Server must mount professional access module');
expect(server.includes('mountProductModule(app);'), 'Existing product module mount must remain intact');

console.log('Professional Access runtime integration repository verification: PASS');
