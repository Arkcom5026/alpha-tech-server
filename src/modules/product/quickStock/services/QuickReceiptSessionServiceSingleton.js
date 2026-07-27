const { prisma: sharedPrisma } = require('../../../../../lib/prisma')
const QuickReceiptSessionService = require('./QuickReceiptSessionService')

class QuickReceiptSessionServiceSingleton extends QuickReceiptSessionService {
  constructor(prisma = sharedPrisma) {
    super(prisma)
  }
}

module.exports = QuickReceiptSessionServiceSingleton
