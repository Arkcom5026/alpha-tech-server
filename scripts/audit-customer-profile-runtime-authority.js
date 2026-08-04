const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourceRoot = path.join(root, 'src');

const ignoredDirectories = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);
const findings = [];

const rules = [
  {
    code: 'PROFILE_BY_USER_UNIQUE_LOOKUP',
    description: 'CustomerProfile must not be resolved as globally unique by userId.',
    pattern: /customerProfile\.findUnique\s*\([\s\S]{0,240}?where\s*:\s*\{\s*userId\s*[,}]/g,
  },
  {
    code: 'PROFILE_FIRST_BY_USER',
    description: 'Runtime must not select an arbitrary first CustomerProfile by userId.',
    pattern: /customerProfile\.findFirst\s*\([\s\S]{0,240}?where\s*:\s*\{\s*userId\s*[,}]/g,
  },
  {
    code: 'LEGACY_PROFILE_HELPER',
    description: 'Legacy helper names encode the retired one-profile-per-user contract.',
    pattern: /findCustomerProfile(?:First)?ByUserId/g,
  },
];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolutePath);
      continue;
    }

    if (!entry.isFile() || !/\.(?:js|cjs|mjs|ts)$/.test(entry.name)) continue;

    const relativePath = path.relative(root, absolutePath).replace(/\\/g, '/');
    const content = fs.readFileSync(absolutePath, 'utf8');

    for (const rule of rules) {
      rule.pattern.lastIndex = 0;
      let match;
      while ((match = rule.pattern.exec(content)) !== null) {
        const line = content.slice(0, match.index).split('\n').length;
        findings.push({
          code: rule.code,
          description: rule.description,
          file: relativePath,
          line,
          excerpt: match[0].replace(/\s+/g, ' ').slice(0, 180),
        });
      }
    }
  }
}

walk(sourceRoot);

console.log('CustomerProfile runtime authority audit');
console.log(`Files root: ${path.relative(root, sourceRoot)}`);
console.log(`Findings: ${findings.length}`);

if (findings.length > 0) {
  console.table(findings.map(({ code, file, line, excerpt }) => ({ code, file, line, excerpt })));
  process.exitCode = 1;
} else {
  console.log('PASS: no runtime path resolves CustomerProfile as globally unique or arbitrary-first by userId.');
}
