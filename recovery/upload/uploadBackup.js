// recovery/upload/uploadBackup.js
// AlphaTech Recovery Toolkit — Upload Engine v2
// Providers: local-mirror, s3-compatible (Cloudflare R2 / AWS S3 / Backblaze S3-compatible)

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VERSION = 'ALPHATECH-RECOVERY-UPLOAD-V2-S3-COMPATIBLE';
const ROOT_DIR = process.cwd();
const REPORT_DIR = process.env.UPLOAD_REPORT_DIR || path.join(ROOT_DIR, 'recovery', 'reports');
const LOG_DIR = process.env.UPLOAD_LOG_DIR || path.join(ROOT_DIR, 'recovery', 'logs');

const PROVIDER = process.env.RECOVERY_UPLOAD_PROVIDER || 'local-mirror';
const LOCAL_UPLOAD_DIR = process.env.RECOVERY_UPLOAD_DIR || path.join(ROOT_DIR, 'recovery', 'offsite');

function nowIso() { return new Date().toISOString(); }
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function log(message) {
  ensureDir(LOG_DIR);
  const line = '[' + nowIso() + '] ' + message;
  console.log(line);
  fs.appendFileSync(path.join(LOG_DIR, 'upload.log'), line + '\n', 'utf8');
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
    throw new Error('Unknown argument: ' + arg);
  }
  return args;
}
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function writeJson(filePath, value) { fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8'); }
function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}
function fileInfo(filePath) {
  const stat = fs.statSync(filePath);
  return { filePath, fileName: path.basename(filePath), sizeBytes: stat.size, sha256: sha256File(filePath) };
}
function resolveSqlPath(manifest, manifestPath) {
  const candidates = [];
  if (manifest.files && manifest.files.sqlFilePath) candidates.push(manifest.files.sqlFilePath);
  if (manifest.files && manifest.files.sqlFileName) candidates.push(path.join(path.dirname(manifestPath), manifest.files.sqlFileName));
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}
function copyAndVerify(sourcePath, targetPath) {
  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
  const sourceHash = sha256File(sourcePath);
  const targetHash = sha256File(targetPath);
  return { sourcePath, targetPath, sourceSha256: sourceHash, targetSha256: targetHash, sizeBytes: fs.statSync(targetPath).size, verified: sourceHash === targetHash };
}
function uploadLocalMirror({ manifestPath, sqlPath, manifest }) {
  const uploadedAt = new Date();
  const datePart = uploadedAt.toISOString().slice(0, 10);
  const backupVersion = manifest.backupVersion || 'unknown-version';
  const targetDir = path.join(LOCAL_UPLOAD_DIR, datePart, backupVersion);
  ensureDir(targetDir);
  const sqlCopy = copyAndVerify(sqlPath, path.join(targetDir, path.basename(sqlPath)));
  const manifestCopy = copyAndVerify(manifestPath, path.join(targetDir, path.basename(manifestPath)));
  const report = {
    uploadVersion: VERSION, provider: PROVIDER, uploadedAt: uploadedAt.toISOString(), targetDir,
    source: { manifest: fileInfo(manifestPath), sql: fileInfo(sqlPath) },
    uploaded: { manifest: manifestCopy, sql: sqlCopy },
    ok: sqlCopy.verified && manifestCopy.verified,
  };
  const uploadManifestPath = path.join(targetDir, path.basename(manifestPath, '.json') + '.upload.json');
  writeJson(uploadManifestPath, report);
  report.uploadManifestPath = uploadManifestPath;
  return report;
}
async function uploadS3Object({ client, PutObjectCommand, bucket, key, filePath, contentType }) {
  const sha256 = sha256File(filePath);
  const stat = fs.statSync(filePath);
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fs.createReadStream(filePath),
    ContentType: contentType,
    Metadata: { sha256, alphatech: 'recovery-backup' },
  }));
  return { key, sourcePath: filePath, sizeBytes: stat.size, sha256, verified: true };
}
async function uploadS3Compatible({ manifestPath, sqlPath, manifest }) {
  let sdk;
  try { sdk = require('@aws-sdk/client-s3'); }
  catch (_error) { throw new Error('Missing dependency @aws-sdk/client-s3. Run: npm install @aws-sdk/client-s3'); }

  const bucket = process.env.S3_BUCKET || process.env.R2_BUCKET;
  const region = process.env.S3_REGION || process.env.R2_REGION || 'auto';
  const endpoint = process.env.S3_ENDPOINT || process.env.R2_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
  const prefix = (process.env.S3_PREFIX || process.env.R2_PREFIX || 'alphatech-backups').replace(/^\/+|\/+$/g, '');

  if (!bucket) throw new Error('Missing S3_BUCKET / R2_BUCKET');
  if (!endpoint) throw new Error('Missing S3_ENDPOINT / R2_ENDPOINT');
  if (!accessKeyId) throw new Error('Missing S3_ACCESS_KEY_ID / R2_ACCESS_KEY_ID');
  if (!secretAccessKey) throw new Error('Missing S3_SECRET_ACCESS_KEY / R2_SECRET_ACCESS_KEY');

  const { S3Client, PutObjectCommand } = sdk;
  const client = new S3Client({ region, endpoint, credentials: { accessKeyId, secretAccessKey }, forcePathStyle: true });

  const uploadedAt = new Date();
  const datePart = uploadedAt.toISOString().slice(0, 10);
  const backupVersion = manifest.backupVersion || 'unknown-version';
  const baseKey = [prefix, datePart, backupVersion].filter(Boolean).join('/');

  const sqlUpload = await uploadS3Object({ client, PutObjectCommand, bucket, key: baseKey + '/' + path.basename(sqlPath), filePath: sqlPath, contentType: 'application/sql' });
  const manifestUpload = await uploadS3Object({ client, PutObjectCommand, bucket, key: baseKey + '/' + path.basename(manifestPath), filePath: manifestPath, contentType: 'application/json' });

  return {
    uploadVersion: VERSION, provider: PROVIDER, uploadedAt: uploadedAt.toISOString(),
    bucket, endpoint, region, prefix, baseKey,
    source: { manifest: fileInfo(manifestPath), sql: fileInfo(sqlPath) },
    uploaded: { manifest: manifestUpload, sql: sqlUpload },
    ok: sqlUpload.verified && manifestUpload.verified,
  };
}
function renderTextReport(report) {
  const lines = [];
  lines.push('========================================');
  lines.push('AlphaTech Recovery Upload Report');
  lines.push('========================================');
  lines.push('Version    : ' + report.uploadVersion);
  lines.push('Provider   : ' + report.provider);
  lines.push('Uploaded At: ' + report.uploadedAt);
  lines.push('Overall    : ' + (report.ok ? 'PASS' : 'FAIL'));
  lines.push('');
  if (report.provider === 'local-mirror') {
    lines.push('Target Dir : ' + report.targetDir);
  } else {
    lines.push('Bucket     : ' + report.bucket);
    lines.push('Base Key   : ' + report.baseKey);
  }
  lines.push('');
  lines.push('Files');
  lines.push('----------------------------------------');
  if (report.provider === 'local-mirror') {
    lines.push('SQL      : ' + (report.uploaded.sql.verified ? 'PASS ' : 'FAIL ') + report.uploaded.sql.targetPath);
    lines.push('Manifest : ' + (report.uploaded.manifest.verified ? 'PASS ' : 'FAIL ') + report.uploaded.manifest.targetPath);
  } else {
    lines.push('SQL      : ' + (report.uploaded.sql.verified ? 'PASS ' : 'FAIL ') + report.uploaded.sql.key);
    lines.push('Manifest : ' + (report.uploaded.manifest.verified ? 'PASS ' : 'FAIL ') + report.uploaded.manifest.key);
  }
  lines.push('----------------------------------------');
  lines.push('Overall: ' + (report.ok ? 'PASS' : 'FAIL'));
  lines.push('========================================');
  return lines.join('\n') + '\n';
}
async function main() {
  ensureDir(REPORT_DIR);
  ensureDir(LOG_DIR);
  const args = parseArgs(process.argv);
  log('============================================================');
  log('AlphaTech Recovery Upload ' + VERSION);
  log('============================================================');
  if (!args.manifestPath) throw new Error('Missing manifest path. Use --manifest "path/to/backup.manifest.json"');
  const manifestPath = path.resolve(args.manifestPath);
  if (!fs.existsSync(manifestPath)) throw new Error('Manifest file not found: ' + manifestPath);
  const manifest = readJson(manifestPath);
  const sqlPath = resolveSqlPath(manifest, manifestPath);
  if (!sqlPath) throw new Error('SQL file not found from manifest.');
  if (manifest.files && manifest.files.sha256) {
    const sqlSha = sha256File(sqlPath);
    if (sqlSha !== manifest.files.sha256) throw new Error('SQL SHA256 mismatch before upload. expected=' + manifest.files.sha256 + ' actual=' + sqlSha);
  }
  let report;
  if (PROVIDER === 'local-mirror') report = uploadLocalMirror({ manifestPath, sqlPath, manifest });
  else if (PROVIDER === 's3-compatible' || PROVIDER === 'r2' || PROVIDER === 's3') report = await uploadS3Compatible({ manifestPath, sqlPath, manifest });
  else throw new Error('Unsupported provider: ' + PROVIDER);

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const reportJson = path.join(REPORT_DIR, 'upload-report-' + ts + '.json');
  const reportTxt = path.join(REPORT_DIR, 'upload-report-' + ts + '.txt');
  const latestJson = path.join(REPORT_DIR, 'upload-report.latest.json');
  const latestTxt = path.join(REPORT_DIR, 'upload-report.latest.txt');
  writeJson(reportJson, report);
  fs.writeFileSync(reportTxt, renderTextReport(report), 'utf8');
  writeJson(latestJson, report);
  fs.writeFileSync(latestTxt, renderTextReport(report), 'utf8');
  log('JSON report: ' + reportJson);
  log('TXT report: ' + reportTxt);
  log('Overall: ' + (report.ok ? 'PASS' : 'FAIL'));
  process.exitCode = report.ok ? 0 : 2;
}
main().catch((error) => {
  log('Upload failed: ' + (error.stack || error.message || String(error)));
  process.exitCode = 1;
});
