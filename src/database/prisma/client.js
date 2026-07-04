// src/database/prisma/client.js
// Canonical Prisma singleton bridge.
// Keep this path for legacy imports, but delegate to lib/prisma.js only.

const { prisma } = require('../../../lib/prisma')

module.exports = prisma
