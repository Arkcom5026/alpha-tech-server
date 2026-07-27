const setNoStoreHeaders = (res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
};

const requireBranchId = (req) => {
  const branchId = Number(req.user?.branchId);
  return Number.isFinite(branchId) ? branchId : null;
};

const parseSessionId = (value) => {
  const sessionId = Number.parseInt(value, 10);
  return Number.isFinite(sessionId) ? sessionId : null;
};

module.exports = {
  setNoStoreHeaders,
  requireBranchId,
  parseSessionId,
};
