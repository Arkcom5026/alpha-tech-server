// recovery/health/healthCheck.js
// AlphaTech Recovery Toolkit — Phase 4.2.2 Health Check
//
// Mission:
// Validate Recovery Platform prerequisites before running backup/restore workflow.
// This tool is read-only except for checking whether folders are writable.
//
// Usage:
//   node recovery/health/healthCheck.js
//
// Exit codes:
//   0 = PASS
//   2 = Health check completed but FAIL
//   1 = Runtime/tool error

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const os = require('os');
const { Client } = require('pg');

const RECOVERY_ENV_PATH = path.join(process.cwd(), '.env.recovery');
if (fs.existsSync(RECOVERY_ENV_PATH)) {
  require('dotenv').config({ path: RECOVERY_ENV_PATH, override: false });
}

const VERSION = 'ALPHATECH-RECOVERY-HEALTH-CHECK-V1';
const ROOT_DIR = process.cwd();
const REPORT_DIR = process.env.HEALTH_REPORT_DIR || path.join(ROOT_DIR, 'recovery', 'reports');
const LOG_DIR = process.env.HEALTH_LOG_DIR || path.join(ROOT_DIR, 'recovery', 'logs');

const PROD_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
const RECOVERY_URL = process.env.RECOVERY_DATABASE_URL || process.env.RESTORE_DATABASE_URL;

const BACKUP_DIR = process.env.BACKUP_OUTPUT_DIR || path.join(ROOT_DIR, 'backups');
const REQUIRED_FREE_MB = Number(process.env.HEALTH_REQUIRED_FREE_MB || 512);

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function log(message) {
  ensureDir(LOG_DIR);
  const line = `[${nowIso()}] ${message}`;
  console.log(line);
  fs.appendFileSync(path.join(LOG_DIR, 'health-check.log'), `${line}\n`, 'utf8');
}

function buildPgConfig(connectionString) {
  const isSupabase = String(connectionString || '').includes('supabase');
  let normalized = connectionString;
  try {
    const url = new URL(connectionString);
    url.searchParams.delete('sslmode');
    normalized = url.toString();
  } catch (_) {}
  return {
    connectionString: normalized,
    ssl: isSupabase ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  };
}

function redact(connectionString) {
  try {
    const url = new URL(connectionString);
    if (url.password) url.password = '***';
    return url.toString();
  } catch (_) {
    return String(connectionString || '').replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  }
}

async function checkDbConnection(name, connectionString, required) {
  const check = {
    name,
    status: 'PENDING',
    required,
    redactedUrl: connectionString ? redact(connectionString) : null,
    error: null,
    details: {},
  };

  if (!connectionString) {
    check.status = required ? 'FAIL' : 'SKIPPED';
    check.error = required ? `${name} connection string is missing` : `${name} connection string not configured`;
    return check;
  }

  const client = new Client(buildPgConfig(connectionString));

  try {
    await client.connect();
    const res = await client.query('SELECT current_database() AS database_name, current_user AS database_user, now() AS server_time;');
    check.status = 'PASS';
    check.details = res.rows[0];
  } catch (error) {
    check.status = required ? 'FAIL' : 'WARN';
    check.error = error.message || String(error);
  } finally {
    await client.end().catch(() => undefined);
  }

  return check;
}

function checkFileExists(name, filePath, required) {
  const exists = fs.existsSync(filePath);
  return {
    name,
    status: exists ? 'PASS' : required ? 'FAIL' : 'WARN',
    required,
    path: filePath,
    error: exists ? null : `${filePath} not found`,
  };
}

function checkDirWritable(name, dirPath, required) {
  const check = {
    name,
    status: 'PENDING',
    required,
    path: dirPath,
    error: null,
  };

  try {
    ensureDir(dirPath);
    const testFile = path.join(dirPath, `.write-test-${Date.now()}.tmp`);
    fs.writeFileSync(testFile, 'ok', 'utf8');
    fs.unlinkSync(testFile);
    check.status = 'PASS';
  } catch (error) {
    check.status = required ? 'FAIL' : 'WARN';
    check.error = error.message || String(error);
  }

  return check;
}

function checkPathExists(name, filePath, required) {
  const exists = fs.existsSync(filePath);
  return {
    name,
    status: exists ? 'PASS' : required ? 'FAIL' : 'WARN',
    required,
    path: filePath,
    error: exists ? null : `${filePath} not found`,
  };
}

function checkDiskSpace() {
  // Node.js without native fs.statfs support on older versions cannot reliably report
  // free space cross-platform. We still record host info and make this a WARN-only check.
  const check = {
    name: 'disk-space',
    status: 'WARN',
    required: false,
    details: {
      platform: os.platform(),
      freeSpaceCheck: 'not enforced by this version',
      requiredFreeMb: REQUIRED_FREE_MB,
    },
    error: 'free space check is informational in v1',
  };

  if (typeof fs.statfsSync === 'function') {
    try {
      const stat = fs.statfsSync(ROOT_DIR);
      const freeBytes = Number(stat.bavail) * Number(stat.bsize);
      const freeMb = freeBytes / 1024 / 1024;
      check.details.freeMb = Number(freeMb.toFixed(2));
      check.status = freeMb >= REQUIRED_FREE_MB ? 'PASS' : 'FAIL';
      check.required = true;
      check.error = check.status === 'PASS' ? null : `free space ${freeMb.toFixed(2)} MB < required ${REQUIRED_FREE_MB} MB`;
    } catch (error) {
      check.status = 'WARN';
      check.error = error.message || String(error);
    }
  }

  return check;
}

function renderTextReport(report) {
  const lines = [];

  lines.push('========================================');
  lines.push('AlphaTech Recovery Health Check');
  lines.push('========================================');
  lines.push(`Version    : ${report.version}`);
  lines.push(`Checked At : ${report.checkedAt}`);
  lines.push(`Overall    : ${report.overallPass ? 'PASS' : 'FAIL'}`);
  lines.push('');
  lines.push('Checks');
  lines.push('----------------------------------------');

  for (const check of report.checks) {
    lines.push(`${check.name.padEnd(28)} ${check.status}`);
    if (check.error) lines.push(`  - ${check.error}`);
  }

  lines.push('----------------------------------------');
  lines.push(`Overall: ${report.overallPass ? 'PASS' : 'FAIL'}`);
  lines.push('========================================');
  return `${lines.join('\n')}\n`;
}

async function main() {
  ensureDir(REPORT_DIR);
  ensureDir(LOG_DIR);

  log('============================================================');
  log(`🩺 AlphaTech Recovery Health Check ${VERSION}`);
  log('============================================================');

  const checks = [];

  checks.push(checkFileExists('env-production', path.join(ROOT_DIR, '.env'), true));
  checks.push(checkFileExists('env-recovery', path.join(ROOT_DIR, '.env.recovery'), false));

  checks.push(checkPathExists('backup-engine-qb', path.join(ROOT_DIR, 'qb.js'), true));
  checks.push(checkPathExists('restore-engine-qbrs', path.join(ROOT_DIR, 'qbrs.js'), false));
  checks.push(checkPathExists('verify-engine-qbv', path.join(ROOT_DIR, 'recovery', 'verify', 'qbv.js'), false));
  checks.push(checkPathExists('job-runner', path.join(ROOT_DIR, 'recovery', 'jobRunner.js'), true));

  checks.push(checkDirWritable('backup-dir-writable', BACKUP_DIR, true));
  checks.push(checkDirWritable('reports-dir-writable', REPORT_DIR, true));
  checks.push(checkDirWritable('logs-dir-writable', LOG_DIR, true));

  checks.push(checkDiskSpace());

  checks.push(await checkDbConnection('production-db', PROD_URL, true));
  checks.push(await checkDbConnection('recovery-db', RECOVERY_URL, false));

  const failedRequired = checks.filter((check) => check.required && check.status === 'FAIL');
  const overallPass = failedRequired.length === 0;

  const checkedAt = nowIso();
  const report = {
    version: VERSION,
    checkedAt,
    overallPass,
    failedRequiredChecks: failedRequired.map((check) => check.name),
    checks,
  };

  const ts = checkedAt.replace(/[:.]/g, '-');
  const jsonPath = path.join(REPORT_DIR, `health-check-${ts}.json`);
  const txtPath = path.join(REPORT_DIR, `health-check-${ts}.txt`);
  const latestJsonPath = path.join(REPORT_DIR, 'health-check.latest.json');
  const latestTxtPath = path.join(REPORT_DIR, 'health-check.latest.txt');

  writeJson(jsonPath, report);
  fs.writeFileSync(txtPath, renderTextReport(report), 'utf8');
  writeJson(latestJsonPath, report);
  fs.writeFileSync(latestTxtPath, renderTextReport(report), 'utf8');

  log(`🧾 JSON report: ${jsonPath}`);
  log(`🧾 TXT report: ${txtPath}`);
  log(`${overallPass ? '✅' : '❌'} Overall: ${overallPass ? 'PASS' : 'FAIL'}`);

  process.exitCode = overallPass ? 0 : 2;
}

main().catch((error) => {
  log(`❌ Health check failed: ${error.stack || error.message || String(error)}`);
  process.exitCode = 1;
});
