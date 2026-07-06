// recovery/upload/uploadBackup.js
// AlphaTech Recovery Toolkit — Phase 4.3 Off-site Upload Engine
//
// Provider v1:
//   local-mirror
//
// Mission:
// Upload/copy verified backup artifacts to an off-site target.
// In this first phase, "local-mirror" means a separate folder/path such as:
//   D:\AlphaTech-Offsite-Backup
// or a mounted cloud folder such as Google Drive Desktop / OneDrive / network drive.
//
// Usage:
//   node recovery/upload/uploadBackup.js --manifest "D:\alpha-tech\server\backups\file.manifest.json"
//
// Env:
//   RECOVERY_UPLOAD_PROVIDER=local-mirror
//   RECOVERY_UPLOAD_DIR=D:\AlphaTech-Offsite-Backup

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VERSION = 'ALPHATECH-RECOVERY-UPLOAD-V1-LOCAL-MIRROR';
const ROOT_DIR = process.cwd();
const REPORT_DIR = process.env.UPLOAD_REPORT_DIR || path.join(ROOT_DIR, 'recovery', 'reports');
const LOG_DIR = process.env.UPLOAD_LOG_DIR || path.join(ROOT_DIR, 'recovery', 'logs');

const PROVIDER = process.env.RECOVERY_UPLOAD_PROVIDER || 'local-mirror';
const UPLOAD_DIR = process.env.RECOVERY_UPLOAD_DIR || path.join(ROOT_DIR, 'recovery', 'offsite');

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function log(message) {
  ensureDir(LOG_DIR);
  const line = `[${nowIso()}] ${message}`;
  console.log(line);
  fs.appendFileSync(path.join(LOG_DIR, 'upload.log'), `${line}\n`, 'utf8');
}

function parseArgs(argv) {
  const args = { manifestPath: null };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--manifest' || arg === '-m') {
      args.manifestPath = argv[i + 1];
      i += 1;
      continue;
    }

    if (!args.manifestPath && !arg.startsWith('--')) {
      args.manifestPath = arg;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function fileInfo(filePath) {
  const stat = fs.statSync(filePath);
  return {
    filePath,
    fileName: path.basename(filePath),
    sizeBytes: stat.size,
    sha256: sha256File(filePath),
  };
}

function resolveSqlPath(manifest, manifestPath) {
  const candidates = [];

  if (manifest.files?.sqlFilePath) candidates.push(manifest.files.sqlFilePath);
  if (manifest.files?.sqlFileName) candidates.push(path.join(path.dirname(manifestPath), manifest.files.sqlFileName));

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }

  return null;
}

function copyAndVerify(sourcePath, targetPath) {
  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);

  const sourceHash = sha256File(sourcePath);
  const targetHash = sha256File(targetPath);

  return {
    sourcePath,
    targetPath,
    sourceSha256: sourceHash,
    targetSha256: targetHash,
    sizeBytes: fs.statSync(targetPath).size,
    verified: sourceHash === targetHash,
  };
}

function uploadLocalMirror({ manifestPath, sqlPath, manifest }) {
  const createdAt = new Date();
  const datePart = createdAt.toISOString().slice(0, 10);
  const backupVersion = manifest.backupVersion || 'unknown-version';

  const targetDir = path.join(UPLOAD_DIR, datePart, backupVersion);
  ensureDir(targetDir);

  const sqlCopy = copyAndVerify(sqlPath, path.join(targetDir, path.basename(sqlPath)));
  const manifestCopy = copyAndVerify(manifestPath, path.join(targetDir, path.basename(manifestPath)));

  const uploadManifest = {
    uploadVersion: VERSION,
    provider: PROVIDER,
    uploadedAt: createdAt.toISOString(),
    targetDir,
    source: {
      manifest: fileInfo(manifestPath),
      sql: fileInfo(sqlPath),
    },
    uploaded: {
      manifest: manifestCopy,
      sql: sqlCopy,
    },
    ok: sqlCopy.verified && manifestCopy.verified,
  };

  const uploadManifestPath = path.join(targetDir, `${path.basename(manifestPath, '.json')}.upload.json`);
  writeJson(uploadManifestPath, uploadManifest);

  uploadManifest.uploadManifestPath = uploadManifestPath;
  return uploadManifest;
}

function renderTextReport(report) {
  const lines = [];
  lines.push('========================================');
  lines.push('AlphaTech Recovery Upload Report');
  lines.push('========================================');
  lines.push(`Version    : ${report.uploadVersion}`);
  lines.push(`Provider   : ${report.provider}`);
  lines.push(`Uploaded At: ${report.uploadedAt}`);
  lines.push(`Overall    : ${report.ok ? 'PASS' : 'FAIL'}`);
  lines.push('');
  lines.push(`Target Dir : ${report.targetDir}`);
  lines.push('');
  lines.push('Files');
  lines.push('----------------------------------------');
  lines.push(`SQL      : ${report.uploaded.sql.verified ? 'PASS' : 'FAIL'} ${report.uploaded.sql.targetPath}`);
  lines.push(`Manifest : ${report.uploaded.manifest.verified ? 'PASS' : 'FAIL'} ${report.uploaded.manifest.targetPath}`);
  lines.push('----------------------------------------');
  lines.push(`Overall: ${report.ok ? 'PASS' : 'FAIL'}`);
  lines.push('========================================');
  return `${lines.join('\n')}\n`;
}

async function main() {
  ensureDir(REPORT_DIR);
  ensureDir(LOG_DIR);

  const args = parseArgs(process.argv);

  log('============================================================');
  log(`☁️ AlphaTech Recovery Upload ${VERSION}`);
  log('============================================================');

  if (!args.manifestPath) {
    throw new Error('Missing manifest path. Use --manifest "D:\\path\\backup.manifest.json"');
  }

  const manifestPath = path.resolve(args.manifestPath);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest file not found: ${manifestPath}`);
  }

  const manifest = readJson(manifestPath);
  const sqlPath = resolveSqlPath(manifest, manifestPath);

  if (!sqlPath) {
    throw new Error('SQL file not found from manifest.');
  }

  if (manifest.files?.sha256) {
    const sqlSha = sha256File(sqlPath);
    if (sqlSha !== manifest.files.sha256) {
      throw new Error(`SQL SHA256 mismatch before upload. expected=${manifest.files.sha256} actual=${sqlSha}`);
    }
  }

  if (PROVIDER !== 'local-mirror') {
    throw new Error(`Unsupported provider in v1: ${PROVIDER}`);
  }

  const report = uploadLocalMirror({ manifestPath, sqlPath, manifest });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const reportJson = path.join(REPORT_DIR, `upload-report-${ts}.json`);
  const reportTxt = path.join(REPORT_DIR, `upload-report-${ts}.txt`);
  const latestJson = path.join(REPORT_DIR, 'upload-report.latest.json');
  const latestTxt = path.join(REPORT_DIR, 'upload-report.latest.txt');

  writeJson(reportJson, report);
  fs.writeFileSync(reportTxt, renderTextReport(report), 'utf8');
  writeJson(latestJson, report);
  fs.writeFileSync(latestTxt, renderTextReport(report), 'utf8');

  log(`🧾 JSON report: ${reportJson}`);
  log(`🧾 TXT report: ${reportTxt}`);
  log(`${report.ok ? '✅' : '❌'} Overall: ${report.ok ? 'PASS' : 'FAIL'}`);

  process.exitCode = report.ok ? 0 : 2;
}

main().catch((error) => {
  log(`❌ Upload failed: ${error.stack || error.message || String(error)}`);
  process.exitCode = 1;
});
