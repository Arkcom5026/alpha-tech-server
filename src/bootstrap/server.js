// @filename: src/bootstrap/server.js

const app = require('../../server');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

server.on('error', (error) => {
  console.error('❌ Server startup failed:', error);
  process.exit(1);
});

module.exports = server;
