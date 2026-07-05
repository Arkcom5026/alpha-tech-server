const { prisma: sharedPrisma } = require('../../../../../lib/prisma')
const QuickStockService = require('./QuickStockService')

class QuickStockServiceSingleton extends QuickStockService {
  constructor(prisma = sharedPrisma) {
    super(prisma)
  }
}

module.exports = QuickStockServiceSingleton
