// Finance module compatibility service for the existing Daily Closing implementation.
// This bridge is intentionally temporary: the next increment will move the full
// query/calculation implementation out of src/features/finance.

const legacyDailyClosingService = require('../../../../features/finance/dailyClosing.service');

const getDailyClosingSummary = (params) =>
  legacyDailyClosingService.getDailyClosingSummary(params);

module.exports = {
  getDailyClosingSummary,
};
