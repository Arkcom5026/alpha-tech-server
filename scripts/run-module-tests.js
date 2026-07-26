const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repositoryRoot = path.resolve(__dirname, '..');
const modulesRoot = path.join(repositoryRoot, 'src', 'modules');
const listOnly = process.argv.includes('--list');
const testFilePattern = /(?:\.test|\.spec)\.(?:cjs|mjs|js)$/i;

function discoverTestFiles(directory) {
  if (!fs.existsSync(directory)) {
    throw new Error(`Module directory does not exist: ${directory}`);
  }

  const discovered = [];
  const pending = [directory];

  while (pending.length > 0) {
    const currentDirectory = pending.pop();
    const entries = fs.readdirSync(currentDirectory, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        pending.push(absolutePath);
        continue;
      }

      if (entry.isFile() && testFilePattern.test(entry.name)) {
        discovered.push(path.relative(repositoryRoot, absolutePath));
      }
    }
  }

  return discovered.sort((left, right) => left.localeCompare(right));
}

function main() {
  const testFiles = discoverTestFiles(modulesRoot);

  console.log(`[test-authority] Discovered ${testFiles.length} module test file(s).`);
  for (const testFile of testFiles) {
    console.log(`  - ${testFile}`);
  }

  if (testFiles.length === 0) {
    console.error('[test-authority] No module test files were discovered.');
    process.exitCode = 1;
    return;
  }

  if (listOnly) {
    return;
  }

  const result = spawnSync(process.execPath, ['--test', ...testFiles], {
    cwd: repositoryRoot,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }

  process.exitCode = Number.isInteger(result.status) ? result.status : 1;
}

try {
  main();
} catch (error) {
  console.error(`[test-authority] ${error instanceof Error ? error.stack : error}`);
  process.exitCode = 1;
}
