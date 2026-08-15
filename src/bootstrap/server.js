// @filename: src/bootstrap/server.js

const app = require('../../server');
const { compactError, recordIncident } = require('../observability/runtimeIncidentLogger');

const PORT = process.env.PORT || 3000;

process.on('uncaughtExceptionMonitor', (error, origin) => {
  recordIncident('PROCESS_UNCAUGHT_EXCEPTION', {
    origin: origin || null,
    error: compactError(error),
  });
});

const server = app.listen(PORT, () => {
  console.log(JSON.stringify({
    level: 'info',
    event: 'server_started',
    port: Number(PORT),
    occurredAt: new Date().toISOString(),
  }));
});

server.on('error', (error) => {
  recordIncident('SERVER_STARTUP_FAILED', {
    port: Number(PORT),
    error: compactError(error),
  });
  process.exit(1);
});

module.exports = server;
