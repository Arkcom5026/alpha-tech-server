// Compatibility bridge for modules that resolve Prisma from src/lib after
// capability-owned files were moved one directory deeper.
// The canonical Prisma client remains server/lib/prisma.js.
module.exports = require('../../lib/prisma')
