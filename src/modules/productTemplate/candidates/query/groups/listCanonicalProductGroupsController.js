const {
  listCanonicalProductGroups,
} = require('./listCanonicalProductGroupsService')

const listCanonicalProductGroupsController = async (req, res) => {
  try {
    const data = await listCanonicalProductGroups({
      user: req.user,
      query: req.query,
    })
    return res.status(200).json({ data })
  } catch (error) {
    console.error('[listCanonicalProductGroupsController] error:', error)
    return res.status(error.status || 500).json({
      error: error.message,
      code: error.code || 'CANONICAL_PRODUCT_GROUP_LIST_FAILED',
    })
  }
}

module.exports = {
  listCanonicalProductGroupsController,
}
