const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REPAIR_ROOT = path.join(ROOT, 'src', 'modules', 'repair');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return entry.isFile() && entry.name.endsWith('.js') ? [absolute] : [];
  });
}

function relative(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function extractRequires(content) {
  const imports = [];
  const pattern = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;
  while ((match = pattern.exec(content))) imports.push(match[1]);
  return imports;
}

function isRepairInternal(resolved) {
  return resolved === REPAIR_ROOT || resolved.startsWith(`${REPAIR_ROOT}${path.sep}`);
}

function run() {
  assert.ok(fs.existsSync(REPAIR_ROOT), 'Repair module root is missing');

  const files = walk(REPAIR_ROOT);
  assert.ok(files.length > 0, 'Repair module contains no JavaScript files');

  const violations = [];
  const directPrismaOwners = [];

  for (const file of files) {
    const rel = relative(file);
    const content = fs.readFileSync(file, 'utf8');

    for (const specifier of extractRequires(content)) {
      if (!specifier.startsWith('.')) continue;

      const resolved = path.resolve(path.dirname(file), specifier);
      const normalized = resolved.replace(/\\/g, '/');

      if (normalized.includes('/src/modules/') && !isRepairInternal(resolved)) {
        violations.push(`${rel} imports another feature module directly: ${specifier}`);
      }

      if (
        normalized.includes('/controllers/') ||
        normalized.includes('/routes/') ||
        normalized.includes('/services/')
      ) {
        const insideRepair = isRepairInternal(resolved);
        if (!insideRepair) {
          violations.push(`${rel} imports a legacy or external runtime layer directly: ${specifier}`);
        }
      }
    }

    const usesPrisma = content.includes("database/prisma/client") || content.includes("lib/prisma");
    if (usesPrisma) directPrismaOwners.push(rel);
  }

  const allowedDirectPrismaOwners = new Set([
    'src/modules/repair/repositories/repairRepository.js',
    'src/modules/repair/middlewares/repairAuthorization.js',
  ]);

  for (const owner of directPrismaOwners) {
    if (!allowedDirectPrismaOwners.has(owner)) {
      violations.push(`${owner} accesses Prisma outside the approved infrastructure boundary`);
    }
  }

  assert.deepStrictEqual(
    [...directPrismaOwners].sort(),
    [...allowedDirectPrismaOwners].sort(),
    'Repair direct Prisma ownership changed; update architecture intentionally before changing this allowlist',
  );

  const repository = fs.readFileSync(
    path.join(REPAIR_ROOT, 'repositories', 'repairRepository.js'),
    'utf8',
  );
  for (const relation of [
    'product',
    'stockItem',
    'customer',
    'supplier',
    'saleItems',
    'employeeProfile',
  ]) {
    assert.ok(
      repository.includes(relation),
      `repairRepository.js missing expected owned data-boundary relation: ${relation}`,
    );
  }

  assert.deepStrictEqual(violations, [], violations.join('\n'));

  console.log('Repair module isolation verifier: PASS');
}

run();
