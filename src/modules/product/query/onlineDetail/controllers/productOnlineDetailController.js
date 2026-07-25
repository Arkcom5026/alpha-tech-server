// src/modules/product/query/onlineDetail/controllers/productOnlineDetailController.js

const { findOperationalProductOnlineById } = require('../../../services/operationalProductRuntimeService')

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

const getProductForOnline = async (req, res) => {
  try {
    const result = await findOperationalProductOnlineById({
      branchId: toInt(req.query.branchId) ?? Number(req.user?.branchId),
      productId: req.params.id,
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'BRANCH_REQUIRED') return res.status(400).json({ error: 'BRANCH_REQUIRED' })
    if (error?.code === 'INVALID_ID') return res.status(400).json({ error: 'INVALID_ID' })
    if (error?.code === 'NOT_FOUND') return res.status(404).json({ error: 'NOT_FOUND' })
    console.error('❌ getProductForOnline error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = { getProductForOnline }
