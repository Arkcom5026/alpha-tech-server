// recovery/retention/retentionPolicy.js
// AlphaTech Recovery Toolkit — Phase 5 Retention Policy
//
// Mission:
// Apply retention policy to backup artifacts safely.
//
// v1 policy:
// - local backup dir retention
// - off-site local-mirror retention
// - dry-run mode supported
//
// Env:
//   BACKUP_OUTPUT_DIR=D:\alpha-tech\server\backups
//   RECOVERY_UPLOAD_DIR=D:\AlphaTech-Offsite-Backup
//   RETENTION_LOCAL_DAYS=30
//   RETENTION_OFFSITE_DAYS=90
//
// Usage:
//   node recovery/retention/retentionPolicy.js --dry-run
//   node recovery/retention/retentionPolicy.js --apply

require('dotenv').config();

const fs = require('fs');
const path = require('path');

const VERSION = 'ALPHATECH-RECOVERY-RETENTION-V1';
const ROOT_DIR = process.cwd();
const REPORT_DIR = process.env.RETENTION_REPORT_DIR || path.join(ROOT_DIR, 'recovery', 'reports');
const LOG_DIR = process.env.RETENTION_LOG_DIR || path.join(ROOT_DIR, 'recovery', 'logs');

const BACKUP_DIR = process.env.BACKUP_OUTPUT_DIR || path.join(ROOT_DIR, 'backups');
const OFFSITE_DIR = process.env.RECOVERY_UPLOAD_DIR || path.join(ROOT_DIR, 'recovery', 'offsite');

const LOCAL_DAYS = Number(process.env.RETENTION_LOCAL_DAYS || process.env.BACKUP_RETENTION_DAYS || 30);
const OFFSITE_DAYS = Number(process.env.RETENTION_OFFSITE_DAYS || 90);

const BACKUP_FILE_PATTERN = /^alphatech_hardened_backup_v\d+_.*\.(sql|manifest\.json)$/;
const UPLOAD_FILE_PATTERN = /^(alphatech_hardened_backup_v\d+_.*\.(sql|manifest\.json|manifest\.upload\.json)|.*\.upload\.json)$/;

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
  fs.appendFileSync(path.join(LOG_DIR, 'retention.log'), `${line}\n`, 'utf8');
}

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
    dryRun: argv.includes('--dry-run') || !argv.includes('--apply'),
  };
}

function listFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];

  const result = [];

  for (const name of fs.readdirSync(dir)) {
    const filePath = path.join(dir, name);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      result.push(...listFilesRecursive(filePath));
      continue;
    }

    if (stat.isFile()) {
      result.push({ filePath, fileName: name, sizeBytes: stat.size, mtimeMs: stat.mtimeMs });
    }
  }

  return result;
}

function applyRetentionForDir({ label, dir, days, pattern, apply }) {
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const files = listFilesRecursive(dir).filter((file) => pattern.test(file.fileName));

  const candidates = files.filter((file) => file.mtimeMs < cutoffMs);
  const deleted = [];
  const kept = [];
  const failed = [];

  for (const file of files) {
    if (file.mtimeMs >= cutoffMs) {
      kept.push({ ...file, reason: 'within-retention-window' });
    }
  }

  for (const file of candidates) {
    if (!apply) {
      deleted.push({ ...file, dryRun: true });
      continue;
    }

    try {
      fs.unlinkSync(file.filePath);
      deleted.push({ ...file, dryRun: false });
    } catch (error) {
      failed.push({ ...file, error: error.message || String(error) });
    }
  }

  return {
    label,
    dir,
    days,
    cutoffAt: new Date(cutoffMs).toISOString(),
    scannedFiles: files.length,
    deleteCandidates: candidates.length,
    deletedFiles: deleted,
    keptFiles: kept.length,
    failedFiles: failed,
    ok: failed.length === 0,
  };
}

function renderTextReport(report) {
  const lines = [];

  lines.push('========================================');
  lines.push('AlphaTech Recovery Retention Report');
  lines.push('========================================');
  lines.push(`Version : ${report.version}`);
  lines.push(`Mode    : ${report.mode}`);
  lines.push(`At      : ${report.createdAt}`);
  lines.push(`Overall : ${report.ok ? 'PASS' : 'FAIL'}`);
  lines.push('');

  for (const target of report.targets) {
    lines.push(`${target.label}`);
    lines.push('----------------------------------------');
    lines.push(`Dir              : ${target.dir}`);
    lines.push(`Retention days   : ${target.days}`);
    lines.push(`Scanned files    : ${target.scannedFiles}`);
    lines.push(`Delete candidates: ${target.deleteCandidates}`);
    lines.push(`Deleted/Dry-run  : ${target.deletedFiles.length}`);
    lines.push(`Failed           : ${target.failedFiles.length}`);
    lines.push('');
  }

  lines.push('========================================');
  return `${lines.join('\n')}\n`;
}

async function main() {
  ensureDir(REPORT_DIR);
  ensureDir(LOG_DIR);

  const args = parseArgs(process.argv);

  log('============================================================');
  log(`🧹 AlphaTech Recovery Retention ${VERSION}`);
  log('============================================================');
  log(`Mode: ${args.apply ? 'APPLY' : 'DRY_RUN'}`);

  const targets = [
    applyRetentionForDir({
      label: 'local-backups',
      dir: BACKUP_DIR,
      days: LOCAL_DAYS,
      pattern: BACKUP_FILE_PATTERN,
      apply: args.apply,
    }),
    applyRetentionForDir({
      label: 'offsite-local-mirror',
      dir: OFFSITE_DIR,
      days: OFFSITE_DAYS,
      pattern: UPLOAD_FILE_PATTERN,
      apply: args.apply,
    }),
  ];

  const ok = targets.every((target) => target.ok);

  const createdAt = nowIso();
  const report = {
    version: VERSION,
    createdAt,
    mode: args.apply ? 'APPLY' : 'DRY_RUN',
    ok,
    policy: {
      localDays: LOCAL_DAYS,
      offsiteDays: OFFSITE_DAYS,
    },
    targets,
  };

  const ts = createdAt.replace(/[:.]/g, '-');
  const jsonPath = path.join(REPORT_DIR, `retention-report-${ts}.json`);
  const txtPath = path.join(REPORT_DIR, `retention-report-${ts}.txt`);
  const latestJson = path.join(REPORT_DIR, 'retention-report.latest.json');
  const latestTxt = path.join(REPORT_DIR, 'retention-report.latest.txt');

  writeJson(jsonPath, report);
  fs.writeFileSync(txtPath, renderTextReport(report), 'utf8');
  writeJson(latestJson, report);
  fs.writeFileSync(latestTxt, renderTextReport(report), 'utf8');

  log(`🧾 JSON report: ${jsonPath}`);
  log(`🧾 TXT report: ${txtPath}`);
  log(`${ok ? '✅' : '❌'} Overall: ${ok ? 'PASS' : 'FAIL'}`);

  process.exitCode = ok ? 0 : 2;
}

main().catch((error) => {
  log(`❌ Retention failed: ${error.stack || error.message || String(error)}`);
  process.exitCode = 1;
});
