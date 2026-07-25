const positionLookupService = require('./positionLookupService');

const getAllPositions = async (_req, res) => {
  try {
    const positions = await positionLookupService.listPositions();
    return res.json(positions);
  } catch (error) {
    console.error('❌ employee position lookup error:', error);
    return res.status(500).json({ message: 'โหลดตำแหน่งล้มเหลว' });
  }
};

module.exports = { getAllPositions };
