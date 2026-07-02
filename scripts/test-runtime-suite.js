// scripts/test-runtime-suite.js
const { spawnSync } = require('child_process');

const tests = [
  'scripts/test-template-search.js',
  'scripts/test-product-template-clone.js',
  'scripts/test-quick-stock-template.js',
];

for (const test of tests) {
  console.log('\n\n🚀 Running:', test);
  const result = spawnSync(process.execPath, [test], { stdio: 'inherit', shell: false });

  if (result.status !== 0) {
    console.error(`\n❌ Runtime suite stopped at: ${test}`);
    process.exit(result.status || 1);
  }
}

console.log('\n🎉 AlphaTech Runtime Test Suite PASS');
