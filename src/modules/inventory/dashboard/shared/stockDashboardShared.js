const getBranchIdFromRequest = (req) => {
  const raw = req?.user?.branchId || req?.branchId || null;
  const branchId = Number(raw);
  return !raw || Number.isNaN(branchId) ? null : branchId;
};

const buildStatusCountMap = (rows = []) =>
  rows.reduce((acc, row) => {
    const status = row?.status;
    if (status) acc[status] = Number(row?._count?._all || 0);
    return acc;
  }, {});

const sumStatuses = (statusCountMap, statuses = []) =>
  statuses.reduce((sum, status) => sum + Number(statusCountMap?.[status] || 0), 0);

const sendStockDashboardError = (res, error, fallbackMessage) => {
  console.error('❌ stockDashboard error:', error);
  const message =
    error?.message ||
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    fallbackMessage ||
    'เกิดข้อผิดพลาด';
  return res.status(500).json({ ok: false, error: message });
};

module.exports = {
  getBranchIdFromRequest,
  buildStatusCountMap,
  sumStatuses,
  sendStockDashboardError,
};
