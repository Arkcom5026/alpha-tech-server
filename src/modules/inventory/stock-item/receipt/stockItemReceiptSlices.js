const { prisma, D, toInt, branchIdFrom } = require('../shared/stockItemShared')

async function addStockItemFromReceipt(req, res) {
  try {
    const branchId = branchIdFrom(req)
    const { receiptItemId, productId, barcode, serialNumber, qrCodeData, warrantyDays, expiredAt, remark, locationCode, source, tag, batchNumber, checkedBy } = req.body || {}
    if (!branchId) return res.status(401).json({ message: 'Unauthorized: missing branch context' })
    if (!receiptItemId || !productId || !barcode) return res.status(400).json({ message: 'Missing required fields (receiptItemId, productId, barcode)' })

    const recItem = await prisma.purchaseOrderReceiptItem.findFirst({
      where: { id: Number(receiptItemId), receipt: { branchId } },
      include: { receipt: true, purchaseOrderItem: { include: { product: true } } },
    })
    if (!recItem) return res.status(404).json({ message: 'ไม่พบรายการรับสินค้านี้ในสาขา' })
    if (recItem.purchaseOrderItem?.productId !== Number(productId)) return res.status(400).json({ message: 'productId ไม่ตรงกับสินค้าในใบสั่งซื้อ' })

    const duplicate = await prisma.stockItem.findUnique({ where: { barcode: String(barcode) } })
    if (duplicate) return res.status(400).json({ message: 'Barcode นี้ถูกใช้แล้ว' })

    const created = await prisma.stockItem.create({
      data: {
        barcode: String(barcode), serialNumber: serialNumber ? String(serialNumber) : null, qrCodeData: qrCodeData || null,
        warrantyDays: toInt(warrantyDays) || null, expiredAt: expiredAt ? new Date(expiredAt) : null, remark: remark || null,
        locationCode: locationCode || null, source: source || 'PURCHASE_ORDER', tag: tag || null, batchNumber: batchNumber || null,
        checkedBy: checkedBy || null, status: 'IN_STOCK', receivedAt: new Date(), costPrice: D(recItem.costPrice || 0),
        product: { connect: { id: Number(productId) } }, branch: { connect: { id: branchId } },
        purchaseOrderReceiptItem: { connect: { id: Number(receiptItemId) } },
      },
    })
    return res.status(201).json(created)
  } catch (error) {
    console.error('[addStockItemFromReceipt] ❌', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

async function getStockItemsByReceipt(req, res) {
  try {
    const branchId = branchIdFrom(req)
    const receiptId = toInt(req.params?.receiptId)
    if (!branchId) return res.status(401).json({ message: 'unauthorized' })
    if (!receiptId) return res.status(400).json({ message: 'receiptId ไม่ถูกต้อง' })
    const receipt = await prisma.purchaseOrderReceipt.findFirst({ where: { id: receiptId, branchId } })
    if (!receipt) return res.status(404).json({ message: 'ไม่พบใบรับสินค้านี้ในสาขา' })
    const receiptItems = await prisma.purchaseOrderReceiptItem.findMany({
      where: { receiptId },
      include: { purchaseOrderItem: { include: { product: true } }, stockItems: true },
      orderBy: { id: 'asc' },
    })
    return res.json(receiptItems)
  } catch (error) {
    console.error('[getStockItemsByReceipt] ❌', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

async function getStockItemsByReceiptIds(req, res) {
  try {
    const branchId = branchIdFrom(req)
    const { receiptIds } = req.body || {}
    if (!branchId) return res.status(401).json({ message: 'unauthorized' })
    if (!Array.isArray(receiptIds) || receiptIds.length === 0) return res.status(400).json({ message: 'receiptIds ต้องเป็น array ที่ไม่ว่าง' })
    const ids = receiptIds.map(Number).filter(Number.isFinite)
    const rows = await prisma.purchaseOrderReceiptItem.findMany({
      where: { receiptId: { in: ids }, receipt: { branchId } },
      include: {
        purchaseOrderItem: { include: { product: true } },
        receipt: { include: { purchaseOrder: { include: { supplier: true } } } },
        stockItems: true,
      },
      orderBy: { id: 'asc' },
    })
    return res.json(rows)
  } catch (error) {
    console.error('[getStockItemsByReceiptIds] ❌', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

module.exports = { addStockItemFromReceipt, getStockItemsByReceipt, getStockItemsByReceiptIds }
