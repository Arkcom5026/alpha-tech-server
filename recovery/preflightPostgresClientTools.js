'use strict';

const { resolvePostgresTool } = require('./postgresClientTools');

function main() {
  const pgDump = resolvePostgresTool('pg_dump', { explicitPath: process.env.PG_DUMP_PATH });
  const psql = resolvePostgresTool('psql', { explicitPath: process.env.PSQL_PATH });
  const ok = pgDump.ok && psql.ok;

  const result = {
    result: ok ? 'PASS' : 'FAIL',
    databaseModified: false,
    ok,
    minimumMajor: pgDump.minimumMajor,
    tools: {
      pgDump: pgDump.ok ? { found: true, path: pgDump.path, major: pgDump.major, version: pgDump.versionText } : { found: false },
      psql: psql.ok ? { found: true, path: psql.path, major: psql.major, version: psql.versionText } : { found: false },
    },
  };

  console.log(JSON.stringify(result, null, 2));
  process.exitCode = ok ? 0 : 1;
}

main();
