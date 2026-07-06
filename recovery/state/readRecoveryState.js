// recovery/state/readRecoveryState.js
// Read current AlphaTech Recovery state.

const fs = require('fs');
const path = require('path');

const stateFile = path.join(process.cwd(), 'recovery', 'state', 'recovery-state.json');

if (!fs.existsSync(stateFile)) {
  console.log('No recovery state found yet.');
  process.exit(0);
}

const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
console.log(JSON.stringify(state, null, 2));
