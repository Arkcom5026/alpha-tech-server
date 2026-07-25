const service = require('../services/productStockModeMigrationService')

const migrateSnToSimple = async (req, res) => {
  try {
    const result = await service.migrateProductToSimple({
      productId: req.params.id,
      branchId: req.user?.branchId,
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'INVALID_ID') return res.status(400).json({ error: 'INVALID_ID' })
    if (error?.code === 'unauthorized') return res.status(401).json({ error: 'unauthorized' })
    if (error?.code === 'NOT_FOUND') return res.status(404).json({ error: 'NOT_FOUND' })
    if (error?.code === 'ALREADY_SIMPLE') return res.status(409).json({ error: 'ALREADY_SIMPLE' })

    console.error('❌ migrateSnToSimple error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = {
  migrateSnToSimple,
}
