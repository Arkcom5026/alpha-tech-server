// recovery/render/renderCron.js
// AlphaTech Recovery Toolkit — Render Cron Entry Point
// Render Cron command:
//   node recovery/render/renderCron.js

require('dotenv').config();

const { spawn } = require('child_process');

function nowIso() { return new Date().toISOString(); }
function log(message) { console.log('[' + nowIso() + '] ' + message); }

function run() {
  return new Promise((resolve) => {
    const args = ['recovery/jobRunner.js', '--backup-workflow', '--upload', '--retention'];
    log('============================================================');
    log('AlphaTech Render Cron Recovery Runner');
    log('============================================================');
    log('Run: node ' + args.join(' '));
    const child = spawn('node', args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (chunk) => {
      for (const line of chunk.toString().split(/\r?\n/).filter(Boolean)) log('jobRunner: ' + line);
    });
    child.stderr.on('data', (chunk) => {
      for (const line of chunk.toString().split(/\r?\n/).filter(Boolean)) log('jobRunner stderr: ' + line);
    });
    child.on('close', (code) => {
      log('Render Cron finished with exitCode=' + code);
      resolve(code);
    });
    child.on('error', (error) => {
      log('Render Cron failed to start: ' + (error.message || String(error)));
      resolve(1);
    });
  });
}
run().then((code) => { process.exitCode = code; });
