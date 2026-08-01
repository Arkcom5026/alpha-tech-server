const service = require('./positionRuntimeService');

const getBranchId = (req) => req?.user?.branchId;

const handle = (operation, successStatus = 200) => async (req, res) => {
  try {
    const result = await operation({
      branchId: getBranchId(req),
      id: req.params?.id,
      query: req.query || {},
      body: req.body || {},
    });
    return res.status(successStatus).json(result);
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    if (statusCode >= 500) {
      console.error('[positionRuntimeController] error:', error);
    }
    return res.status(statusCode).json(
      error?.payload || { error: 'เกิดข้อผิดพลาดในระบบ' },
    );
  }
};

module.exports = {
  listPositions: handle(service.listPositions),
  getDropdowns: handle(service.getDropdowns),
  getById: handle(service.getById),
  createPosition: handle(service.createPosition, 201),
  updatePosition: handle(service.updatePosition),
  toggleActive: handle(service.toggleActive),
  hardDelete: handle(service.hardDelete),
};
