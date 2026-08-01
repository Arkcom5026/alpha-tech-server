const { prisma } = require('../../../../lib/prisma');
const { BrandRepository } = require('../repositories/brandRepository');

module.exports = new BrandRepository(prisma);
