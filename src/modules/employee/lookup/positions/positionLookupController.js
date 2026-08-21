const positionLookupService = require('./positionLookupService');

const getAllPositions = async (req, res) => {
  try {
    const branchId = req.user?.branchId || req.user?.employeeProfile?.branchId;
    const positions = await positionLookupService.listPositions({ branchId });
    return res.json(positions);
  } catch (error) {
    if (error?.code === 'EMPLOYEE_POSITION_LOOKUP_BRANCH_REQUIRED') {
      return res.status(403).json({
        code: error.code,
        message: 'บัญชีผู้ใช้นี้ไม่ได้ผูกกับสาขาที่ใช้งาน',
      });
    }

    console.error('❌ employee position lookup error:', error);
    return res.status(500).json({ message: 'โหลดตำแหน่งล้มเหลว' });
  }
};

module.exports = { getAllPositions };
