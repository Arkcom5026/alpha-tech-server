// src/modules/product/quickStock/services/QuickStockService_Runtime_SafeTransaction.js
// Legacy compatibility shim.
// Runtime now uses the canonical QuickStockService implementation, which receives
// the shared Prisma singleton from the controller/service caller.

module.exports = require('./QuickStockService');
