const { prisma: sharedPrisma } = require('../../../../../lib/prisma')
const QuickReceiptCompleteService = require('./QuickReceiptCompleteService')

class QuickReceiptCompleteServiceSingleton extends QuickReceiptCompleteService {
  constructor(prisma = sharedPrisma) {
    super(prisma)
  }
}

module.exports = QuickReceiptCompleteServiceSingleton
