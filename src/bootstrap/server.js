// @filename: src/bootstrap/server.js

const app = require('../../server');
const { prisma } = require('../../lib/prisma');
const { compactError, recordIncident } = require('../observability/runtimeIncidentLogger');

const PORT = process.env.PORT || 3000;

process.on('uncaughtExceptionMonitor', (error, origin) => {
  recordIncident('PROCESS_UNCAUGHT_EXCEPTION', {
    origin: origin || null,
    error: compactError(error),
  });
});

const warmPrismaInBackground = () => {
  const startedAt = process.hrtime.bigint();

  Promise.resolve(prisma.$connect())
    .then(() => {
      if (process.env.AUTH_PERF_TRACE === '1') {
        const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        console.log(`[auth-perf] prisma.warmup ${elapsedMs.toFixed(1)}ms`);
      }
    })
    .catch((error) => {
      recordIncident('PRISMA_BACKGROUND_WARMUP_FAILED', {
        error: compactError(error),
      });
    });
};

const server = app.listen(PORT, () => {
  console.log(JSON.stringify({
    level: 'info',
    event: 'server_started',
    port: Number(PORT),
    occurredAt: new Date().toISOString(),
  }));

  // Keep HTTP availability independent from database connection warm-up.
  // This primes Prisma's query engine/pool after the port is already listening,
  // so the first auth request does not pay the full cold connection cost.
  setImmediate(warmPrismaInBackground);
});

server.on('error', (error) => {
  recordIncident('SERVER_STARTUP_FAILED', {
    port: Number(PORT),
    error: compactError(error),
  });
  process.exit(1);
});

module.exports = server;
