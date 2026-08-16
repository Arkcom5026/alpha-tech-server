'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MINIMUM_MAJOR_VERSION = 17;

function executableName(toolName, platform = process.platform) {
  return platform === 'win32' ? `${toolName}.exe` : toolName;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function installedWindowsCandidates(toolName, env = process.env, fsImpl = fs) {
  const exe = executableName(toolName, 'win32');
  const candidates = [];
  const roots = unique([
    env.ProgramW6432,
    env.ProgramFiles,
    env['ProgramFiles(x86)'],
    'C:\\Program Files',
  ]);

  for (const root of roots) {
    const postgresRoot = path.join(root, 'PostgreSQL');
    if (!fsImpl.existsSync(postgresRoot)) continue;

    let versions = [];
    try {
      versions = fsImpl.readdirSync(postgresRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^\d+(?:\.\d+)?$/.test(entry.name))
        .map((entry) => entry.name)
        .sort((left, right) => Number(right) - Number(left));
    } catch (_) {
      versions = [];
    }

    for (const version of versions) {
      candidates.push(path.join(postgresRoot, version, 'bin', exe));
    }
  }

  return candidates;
}

function pathCandidates(toolName, env = process.env, platform = process.platform) {
  const exe = executableName(toolName, platform);
  return String(env.PATH || env.Path || '')
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => path.join(entry, exe));
}

function toolVersion(toolPath, spawnSyncImpl = spawnSync) {
  const result = spawnSyncImpl(toolPath, ['--version'], {
    shell: false,
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.error || result.status !== 0) {
    return { ok: false, major: null, versionText: null };
  }

  const versionText = String(result.stdout || result.stderr || '').trim();
  const match = versionText.match(/(\d+)(?:\.\d+)?/);
  const major = match ? Number(match[1]) : null;
  return {
    ok: Number.isInteger(major),
    major,
    versionText,
  };
}

function resolvePostgresTool(toolName, {
  explicitPath = null,
  env = process.env,
  platform = process.platform,
  fsImpl = fs,
  spawnSyncImpl = spawnSync,
  minimumMajor = MINIMUM_MAJOR_VERSION,
} = {}) {
  const exe = executableName(toolName, platform);
  const candidates = [
    explicitPath,
    env.POSTGRES_CLIENT_BIN ? path.join(env.POSTGRES_CLIENT_BIN, exe) : null,
    ...(platform === 'win32' ? installedWindowsCandidates(toolName, env, fsImpl) : []),
    ...pathCandidates(toolName, env, platform),
    ...(platform === 'win32' ? [] : [`/usr/local/bin/${exe}`, `/usr/bin/${exe}`]),
  ];

  for (const candidate of unique(candidates)) {
    if (!candidate || !fsImpl.existsSync(candidate)) continue;
    const version = toolVersion(candidate, spawnSyncImpl);
    if (!version.ok || version.major < minimumMajor) continue;
    return {
      ok: true,
      toolName,
      path: candidate,
      major: version.major,
      versionText: version.versionText,
      minimumMajor,
    };
  }

  return {
    ok: false,
    toolName,
    path: null,
    major: null,
    versionText: null,
    minimumMajor,
  };
}

function requirePostgresTool(toolName, options = {}) {
  const resolved = resolvePostgresTool(toolName, options);
  if (!resolved.ok) {
    const explicitVariable = toolName === 'pg_dump' ? 'PG_DUMP_PATH' : 'PSQL_PATH';
    throw new Error(
      `PostgreSQL ${toolName} ${MINIMUM_MAJOR_VERSION}+ was not found. ` +
      `Install PostgreSQL client tools or set ${explicitVariable}/POSTGRES_CLIENT_BIN.`
    );
  }
  return resolved;
}

module.exports = {
  MINIMUM_MAJOR_VERSION,
  requirePostgresTool,
  resolvePostgresTool,
};
