const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const repairRoot = path.join(root, 'src', 'modules', 'repair');

function collectTests(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectTests(full, out);
    else if (entry.isFile() && /(?:\.test|\.contract\.test)\.js$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = collectTests(repairRoot).sort();
if (!files.length) {
  console.error('[repair-runtime] no repair tests found');
  process.exit(1);
}

console.log(`[repair-runtime] running ${files.length} repair tests`);
const result = spawnSync(process.execPath, ['--test', ...files], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
