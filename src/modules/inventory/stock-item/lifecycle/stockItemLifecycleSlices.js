const { prisma, toInt, branchIdFrom } = require('../shared/stockItemShared')

async function deleteStockItem(req, res) {
  try {
    const branchId = branchIdFrom(req)
    const id = toInt(req.params?.id)
    if (!branchId) return res.status(401).json({ message: 'unauthorized' })
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' })
    const found = await prisma.stockItem.findFirst({ where: { id, branchId }, include: { saleItems: { select: { id: true }, take: 1 } } })
    if (!found) return res.status(404).json({ message: 'ไม่พบรายการในสาขา' })
    if (found.status !== 'IN_STOCK' || (found.saleItems && found.saleItems.length > 0)) {
      return res.status(409).json({ message: 'ลบไม่ได้: สถานะไม่ใช่ IN_STOCK หรือมีการอ้างอิงการขายแล้ว' })
    }
    return res.json(await prisma.stockItem.delete({ where: { id } }))
  } catch (error) {
    console.error('[deleteStockItem] ❌', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

async function updateStockItemStatus(req, res) {
  try {
    const branchId = branchIdFrom(req)
    const id = toInt(req.params?.id)
    const { status } = req.body || {}
    if (!branchId) return res.status(401).json({ message: 'unauthorized' })
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' })
    if (!['IN_STOCK', 'SOLD', 'CLAIMED', 'LOST'].includes(status)) return res.status(400).json({ message: 'สถานะไม่ถูกต้อง' })
    if (status === 'SOLD') return res.status(400).json({ message: 'กรุณาใช้ endpoint markStockItemsAsSold สำหรับการขาย' })
    const exists = await prisma.stockItem.findFirst({ where: { id, branchId } })
    if (!exists) return res.status(404).json({ message: 'ไม่พบรายการในสาขา' })
    return res.json(await prisma.stockItem.update({ where: { id }, data: { status } }))
  } catch (error) {
    console.error('[updateStockItemStatus] ❌', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

async function markStockItemsAsSold(req, res) {
  try {
    const branchId = branchIdFrom(req)
    const { stockItemIds } = req.body || {}
    if (!branchId) return res.status(401).json({ message: 'unauthorized' })
    if (!Array.isArray(stockItemIds) || stockItemIds.length === 0) return res.status(400).json({ message: 'stockItemIds ต้องเป็น array' })
    const ids = [...new Set(stockItemIds.map(Number).filter(Number.isFinite))]
    if (ids.length === 0) return res.status(400).json({ message: 'stockItemIds ไม่ถูกต้อง' })

    const existing = await prisma.stockItem.findMany({ where: { id: { in: ids }, branchId }, select: { id: true, status: true } })
    const existingMap = new Map(existing.map((item) => [item.id, item]))
    const notFoundIds = ids.filter((id) => !existingMap.has(id))
    const notInStock = existing.filter((item) => item.status !== 'IN_STOCK')
    if (notFoundIds.length || notInStock.length) {
      return res.status(409).json({
        code: 'STOCK_ITEMS_NOT_SELLABLE',
        message: 'อัปเดตสถานะเป็น SOLD ไม่ครบ: มีบางรายการไม่อยู่ในสาขา/ไม่พบ หรือสถานะไม่ใช่ IN_STOCK',
        notFoundIds,
        notSellable: notInStock.map((item) => ({ id: item.id, status: item.status })),
      })
    }

    const updated = await prisma.stockItem.updateMany({
      where: { id: { in: ids }, branchId, status: 'IN_STOCK' },
      data: { status: 'SOLD', soldAt: new Date() },
    })
    if (updated.count !== ids.length) {
      const after = await prisma.stockItem.findMany({ where: { id: { in: ids }, branchId }, select: { id: true, status: true } })
      const afterMap = new Map(after.map((item) => [item.id, item.status]))
      const failed = ids.filter((id) => afterMap.get(id) !== 'SOLD').map((id) => ({ id, status: afterMap.get(id) || 'NOT_FOUND' }))
      return res.status(409).json({
        code: 'STOCK_ITEMS_SOLD_PARTIAL',
        message: 'อัปเดตสถานะเป็น SOLD ไม่ครบ (อาจมีการขายซ้ำ/สถานะเปลี่ยนระหว่างทำรายการ)',
        updatedCount: updated.count,
        expectedCount: ids.length,
        failed,
      })
    }
    return res.status(200).json({ count: updated.count })
  } catch (error) {
    console.error('❌ [markStockItemsAsSold] error:', error)
    return res.status(500).json({ message: 'Server error' })
  }
}

module.exports = { deleteStockItem, updateStockItemStatus, markStockItemsAsSold }
