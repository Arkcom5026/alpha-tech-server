'use strict';

const {
  loadDeliveryNoteListLifecycleSummaries,
} = require('./deliveryNoteListLifecycleService');

const parseSaleIds = (value) => String(value || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

const getDeliveryNoteListLifecycleSummaries = async (req, res) => {
  try {
    const summaries = await loadDeliveryNoteListLifecycleSummaries({
      branchId: req.user?.branchId,
      saleIds: parseSaleIds(req.query?.saleIds),
    });
    return res.json({ data: summaries });
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    if (statusCode >= 500) {
      console.error('[delivery-note-list-lifecycle] failed', error);
    }
    return res.status(statusCode).json({
      error: error?.code || 'DELIVERY_NOTE_LIST_LIFECYCLE_FAILED',
      message: error?.message || 'ไม่สามารถโหลดสถานะใบส่งของได้',
    });
  }
};

module.exports = Object.freeze({
  getDeliveryNoteListLifecycleSummaries,
});
