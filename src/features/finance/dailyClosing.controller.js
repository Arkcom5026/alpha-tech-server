// src/features/finance/dailyClosing.controller.js

const dailyClosingService = require('./dailyClosing.service');

const getDailyClosingSummary = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);

    if (!branchId || Number.isNaN(branchId)) {
      return res.status(401).json({
        message: 'unauthorized',
      });
    }

    const summary = await dailyClosingService.getDailyClosingSummary({
      branchId,
      date: req.query?.date,
      fromDate: req.query?.fromDate,
      toDate: req.query?.toDate,
    });

    return res.json(summary);
  } catch (error) {
    console.error('❌ [getDailyClosingSummary] error:', error);

    const status = error?.status || 500;

    return res.status(status).json({
      message: error?.message || 'ไม่สามารถโหลดสรุปปิดยอดได้',
    });
  }
};

module.exports = {
  getDailyClosingSummary,
};
