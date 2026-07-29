const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const files = [
  'src/modules/professional-access/index.js',
  'src/modules/professional-access/routes/professionalAccessRoutes.js',
  'src/modules/professional-access/accountant-workspace/accountantWorkspaceRoutes.js',
  'src/modules/professional-access/tax-review-collaboration/taxReviewRoutes.js',
  'server.js',
];

for (const file of files) {
  expect(fs.existsSync(path.join(root, file)), `Missing ${file}`);
}

const moduleIndex = read(files[0]);
const aggregateRoutes = read(files[1]);
const workspaceRoutes = read(files[2]);
const taxReviewRoutes = read(files[3]);
const server = read(files[4]);

expect(moduleIndex.includes("app.use('/api/professional-access'"), 'Module must mount under /api/professional-access');
expect(aggregateRoutes.includes('accountantWorkspaceRoutes'), 'Aggregator must include accountant workspace routes');
expect(aggregateRoutes.includes('taxReviewRoutes'), 'Aggregator must include tax review routes');
expect(workspaceRoutes.includes('router.use(verifyToken)'), 'Workspace routes must remain authenticated');
expect(taxReviewRoutes.includes('router.use(verifyToken)'), 'Tax review routes must remain authenticated');
expect(server.includes("require('./src/modules/professional-access')"), 'Server must import professional access module');
expect(server.includes('mountProfessionalAccessModule(app);'), 'Server must mount professional access module');
expect(server.includes('mountProductModule(app);'), 'Existing product module mount must remain intact');

console.log('Professional Access runtime integration repository verification: PASS');
