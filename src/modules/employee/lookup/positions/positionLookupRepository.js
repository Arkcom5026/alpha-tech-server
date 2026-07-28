const { prisma } = require('../../../../lib/prisma');

const listPositions = () => prisma.position.findMany({ orderBy: { name: 'asc' } });

module.exports = { listPositions };
