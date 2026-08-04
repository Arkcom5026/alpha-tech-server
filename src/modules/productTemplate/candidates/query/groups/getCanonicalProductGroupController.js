const { getCanonicalProductGroup } = require('./getCanonicalProductGroupService')

const getCanonicalProductGroupController = async (req, res) => {
  try {
    const data = await getCanonicalProductGroup({
      user: req.user,
      params: req.params,
      query: req.query,
    })
    return res.status(200).json({ data })
  } catch (error) {
    console.error('[getCanonicalProductGroupController] error:', error)
    return res.status(error.status || 500).json({
      error: error.message || 'Failed to load Canonical Product Group',
      code: error.code || 'CANONICAL_GROUP_DETAIL_FAILED',
    })
  }
}

module.exports = { getCanonicalProductGroupController }
