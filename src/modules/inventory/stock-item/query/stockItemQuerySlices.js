const { prisma, toNum, toInt, branchIdFrom } = require('../shared/stockItemShared')

const noCache = (res) => res.set({
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache', Expires: '0', 'Surrogate-Control': 'no-store',
})

const pricesOf = (branchPrice) => ({
  retail: toNum(branchPrice?.priceRetail),
  wholesale: toNum(branchPrice?.priceWholesale),
  technician: toNum(branchPrice?.priceTechnician),
  online: toNum(branchPrice?.priceOnline),
})

async function searchStockItem(req, res) {
  try {
    const query = String(req.query?.query || req.query?.barcode || '').trim()
    const branchId = branchIdFrom(req)
    if (!query || !branchId) return res.status(400).json({ error: 'Missing query or branchId' })
    noCache(res)

    const exact = await prisma.stockItem.findFirst({
      where: { branchId, OR: [{ barcode: { equals: query } }, { serialNumber: { equals: query } }] },
      include: { product: true },
    })
    if (exact) {
      if (exact.status !== 'IN_STOCK') return res.status(409).json({
        code: 'BARCODE_NOT_SELLABLE', status: exact.status,
        message: `สินค้านี้ไม่พร้อมขาย (สถานะ: ${exact.status})`,
      })
      const branchPrice = await prisma.branchPrice.findFirst({
        where: { branchId, productId: exact.productId },
        select: { productId: true, priceRetail: true, priceWholesale: true, priceTechnician: true, priceOnline: true },
      })
      return res.json([{ ...exact, stockItemId: exact.id, prices: pricesOf(branchPrice) }])
    }

    const lotBarcode = await prisma.barcodeReceiptItem.findUnique({
      where: { barcode: query },
      include: {
        simpleLot: true,
        receiptItem: { include: { receipt: true, product: true, purchaseOrderItem: { include: { product: true } } } },
      },
    })
    if (lotBarcode) {
      if (toInt(lotBarcode.branchId) !== branchId) return res.status(404).json({ code: 'BARCODE_NOT_FOUND', message: 'ไม่พบบาร์โค้ด/สินค้าในระบบ' })
      const isLot = lotBarcode.kind === 'LOT' || lotBarcode.simpleLotId != null
      if (isLot) {
        const product = lotBarcode.receiptItem?.product || lotBarcode.receiptItem?.purchaseOrderItem?.product
        if (!product) return res.status(400).json({ code: 'LOT_PRODUCT_MISSING', message: 'ไม่พบข้อมูลสินค้าในบาร์โค้ดล็อต' })
        const qtyRemaining = lotBarcode.simpleLot ? toNum(lotBarcode.simpleLot.qtyRemaining) : toNum(lotBarcode.receiptItem?.quantity)
        if (!qtyRemaining || qtyRemaining <= 0) return res.status(409).json({ code: 'LOT_EMPTY', message: 'ล็อตนี้ไม่มีจำนวนคงเหลือให้ขายแล้ว' })
        const branchPrice = await prisma.branchPrice.findFirst({
          where: { branchId, productId: product.id },
          select: { productId: true, priceRetail: true, priceWholesale: true, priceTechnician: true, priceOnline: true },
        })
        return res.json([{
          kind: 'LOT', stockItemId: null, barcode: lotBarcode.barcode,
          simpleLotId: lotBarcode.simpleLotId || lotBarcode.simpleLot?.id || null,
          productId: product.id, product, qtyRemaining, prices: pricesOf(branchPrice),
        }])
      }
    }

    const stockItems = await prisma.stockItem.findMany({
      where: {
        status: 'IN_STOCK', branchId,
        OR: [
          { product: { name: { contains: query, mode: 'insensitive' } } },
          { barcode: { contains: query } },
          { serialNumber: { contains: query } },
        ],
      },
      include: { product: true }, orderBy: { id: 'asc' }, take: 20,
    })
    if (!stockItems?.length) return res.status(404).json({ code: 'BARCODE_NOT_FOUND', message: 'ไม่พบบาร์โค้ด/สินค้าในระบบ' })

    const productIds = [...new Set(stockItems.map((item) => item.productId))]
    const branchPrices = await prisma.branchPrice.findMany({
      where: { branchId, productId: { in: productIds } },
      select: { productId: true, priceRetail: true, priceWholesale: true, priceTechnician: true, priceOnline: true },
    })
    const priceMap = new Map(branchPrices.map((price) => [price.productId, price]))
    return res.json(stockItems.map((item) => ({ ...item, stockItemId: item.id, prices: pricesOf(priceMap.get(item.productId)) })))
  } catch (error) {
    console.error('❌ [searchStockItem] error:', error)
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาสินค้า' })
  }
}

async function updateSerialNumber(req, res) {
  try {
    const branchId = branchIdFrom(req)
    const { barcode } = req.params || {}
    const { serialNumber } = req.body || {}
    if (!branchId) return res.status(401).json({ error: 'unauthorized' })
    if (!barcode) return res.status(400).json({ error: 'Missing barcode.' })
    const stockItem = await prisma.stockItem.findFirst({ where: { barcode: String(barcode), branchId } })
    if (!stockItem) return res.status(404).json({ error: 'Stock item not found.' })
    if (serialNumber) {
      const duplicate = await prisma.stockItem.findFirst({ where: { serialNumber: String(serialNumber), NOT: { id: stockItem.id } } })
      if (duplicate) return res.status(400).json({ error: 'SN นี้ถูกใช้ไปแล้วกับสินค้ารายการอื่น' })
    }
    const updated = await prisma.stockItem.update({
      where: { id: stockItem.id }, data: { serialNumber: serialNumber || null },
      include: { purchaseOrderReceiptItem: { select: { receiptId: true } } },
    })
    return res.json({ message: 'SN updated', stockItem: updated })
  } catch (error) {
    console.error('[updateSerialNumber] ❌ Error:', error)
    return res.status(500).json({ error: 'Failed to update serial number.' })
  }
}

async function getAvailableStockItemsByProduct(req, res) {
  try {
    const productId = toInt(req.query?.productId)
    const branchId = branchIdFrom(req)
    if (!productId || !branchId) return res.status(400).json({ error: 'ต้องระบุ productId และอยู่ภายใต้ branch ที่ล็อกอิน' })
    const items = await prisma.stockItem.findMany({
      where: { branchId, productId, status: 'IN_STOCK' },
      select: {
        id: true, barcode: true, serialNumber: true, productId: true, costPrice: true, receivedAt: true,
        product: {
          select: {
            name: true, brand: { select: { name: true } }, unit: { select: { name: true } },
            productType: { select: { name: true, globalProductType: { select: { category: { select: { name: true } } } } } },
          },
        },
      },
      orderBy: { id: 'asc' }, take: 200,
    })
    return res.json(items)
  } catch (error) {
    console.error('[getAvailableStockItemsByProduct] ❌', error)
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการโหลด stock item' })
  }
}

module.exports = { searchStockItem, updateSerialNumber, getAvailableStockItemsByProduct }
