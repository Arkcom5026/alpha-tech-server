const branchLookupService = require('./branchLookupService');

const getBranchDropdowns = async (_req, res) => {
  try {
    const branches = await branchLookupService.listBranches();
    return res.json(branches);
  } catch (error) {
    console.error('❌ employee branch lookup error:', error);
    return res.status(500).json({ message: 'โหลดสาขาล้มเหลว' });
  }
};

module.exports = { getBranchDropdowns };
