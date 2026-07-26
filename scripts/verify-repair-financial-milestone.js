const { execFileSync } = require('child_process');
const path = require('path');

const scripts = [
  'verify-repair-part-usage-reversal.js',
  'verify-repair-actual-part-usage-summary.js',
  'verify-repair-financial-summary.js',
  'verify-repair-settlement-foundation.js',
  'verify-repair-handover-settlement-guard.js',
  'verify-repair-invoice-boundary.js',
];

for (const script of scripts) {
  execFileSync(process.execPath, [path.join(__dirname, script)], {
    stdio: 'inherit',
  });
}

console.log('Repair Financial Milestone: PASS');
