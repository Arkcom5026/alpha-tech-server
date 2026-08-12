// src/modules/product/quickStock/services/QuickStockService.js
// QuickStockService Runtime Trace Edition v3

const { PrismaClient } = require('@prisma/client')
const priceAuthorityPolicy = require('../../pricing/policies/priceAuthorityPolicy')
const { decideOperationalProductMode } = require('../../runtime/policies/operationalProductModePolicy')
const { assertProductCanReceive } = require('../../../inventory/policies/productInventoryMutationPolicy')
const { QuickStockRepository, toInt, toNumber } = require('../repositories/quickStockRepository')

class QuickStockService {
  constructor(prisma, repository = null) {
    this.prisma = prisma || new PrismaClient()
    this.repository = repository || new QuickStockRepository(this.prisma)
  }

  makeTraceId(prefix = 'QS') { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}` }
  trace(scope, step, data = {}) { if (!(process.env.NODE_ENV === 'production' && process.env.QS_TRACE !== '1')) console.log(`[QS:${scope}] ${step}`, data) }
  traceError(scope, step, error, data = {}) { console.error(`[QS:${scope}] ${step} FAILED`, { message: error?.message, code: error?.code, statusCode: error?.statusCode || error?.status, details: error?.details, data, stack: error?.stack }) }
  async timed(scope, step, fn, data = {}) { const startedAt = Date.now(); this.trace(scope, `${step}_BEGIN`, data); try { const result = await fn(); this.trace(scope, `${step}_OK`, { ...data, elapsedMs: Date.now() - startedAt }); return result } catch (error) { this.traceError(scope, step, error, { ...data, elapsedMs: Date.now() - startedAt }); throw error } }

  async getActiveProducts() { return this.repository.findActiveProducts() }
  async getProductTypes() { return this.repository.findProductTypes() }
  async getStockByBranch(branchId) { return this.repository.findStockByBranch({ branchId }) }

  async quickStockInAllInOne(data, actor = {}) {
    const traceScope = 'quickStockInAllInOne'
    const traceId = this.makeTraceId('QS-AIO')
    const branchId = toInt(actor.branchId)
    const empId = toInt(actor.employeeId)
    const runtimePolicy = decideOperationalProductMode({ mode: data.mode, trackSerialNumber: data.trackSerialNumber, noSN: data.noSN, inventoryBehavior: data.inventoryBehavior })
    assertProductCanReceive(runtimePolicy)
    const isSN = runtimePolicy.mode === 'STRUCTURED'

    if (isSN && (!Array.isArray(data.items) || !data.items.length)) {
      throw Object.assign(new Error('กรุณาส่งข้อมูลรายการคีย์สแกน Serial Number และราคาทุนรายชิ้น'), { statusCode: 400, code: 'ITEMS_REQUIRED' })
    }

    const itemCosts = isSN
      ? data.items.map((item, index) => {
        const costPrice = Number(item?.costPrice)
        try {
          priceAuthorityPolicy.assertPricePayload({
            actor: { branchId, employeeId: empId, role: actor.role, v2Role: actor.v2Role },
            payload: { costPrice },
          })
        } catch (error) {
          error.detail = { ...(error.detail || {}), index }
          throw error
        }
        return costPrice
      })
      : [Number(data?.lotCostPrice)]

    const initialCostPrice = itemCosts[0]
    const hasMixedItemCosts = itemCosts.some((value) => Math.abs(value - initialCostPrice) > 0.0001)
    if (hasMixedItemCosts) {
      throw Object.assign(new Error('ราคาทุนรายชิ้นต้องเท่ากันเมื่อใช้เป็นราคาทุนเริ่มต้นของสินค้า'), {
        statusCode: 409,
        status: 409,
        code: 'QUICK_STOCK_MIXED_ITEM_COST_NOT_ALLOWED',
        detail: { costs: itemCosts },
      })
    }

    const pricePayload = {
      costPrice: initialCostPrice,
      priceRetail: data?.priceRetail,
      priceWholesale: data?.priceWholesale,
      priceTechnician: data?.priceTechnician,
      priceOnline: data?.priceOnline,
    }
    const authority = priceAuthorityPolicy.assertPricePayload({
      actor: { branchId, employeeId: empId, role: actor.role, v2Role: actor.v2Role },
      payload: pricePayload,
    })

    return this.prisma.$transaction(async (tx) => {
      let brandId = data.brandId ? toInt(data.brandId) : null
      if (data.isNewBrand && data.brandName) {
        const normalizedName = data.brandName.toLowerCase().trim().replace(/\s+/g, '')
        const existingBrand = await this.repository.findBrandByNormalizedName({ db: tx, normalizedName })
        brandId = existingBrand?.id || (await this.repository.createBrand({ db: tx, name: data.brandName, normalizedName })).id
      }

      const product = await this.repository.createProduct({ db: tx, data: { name: data.productName.trim(), productTypeId: toInt(data.productTypeId), brandId, mode: runtimePolicy.mode, trackSerialNumber: runtimePolicy.trackSerialNumber, noSN: runtimePolicy.noSN, inventoryBehavior: runtimePolicy.inventoryBehavior, saleBarcode: runtimePolicy.mode === 'SIMPLE' ? String(data.saleBarcode || data.productBarcode || '').trim() || null : null, active: true } })

      await this.repository.createBranchPrice({ db: tx, data: { productId: product.id, branchId: authority.branchId, costPrice: pricePayload.costPrice, priceRetail: pricePayload.priceRetail, priceWholesale: pricePayload.priceWholesale, priceTechnician: pricePayload.priceTechnician, priceOnline: pricePayload.priceOnline, updatedBy: authority.employeeId, isActive: true } })

      let totalAddedQty = 0
      let lastCost = 0
      if (isSN) {
        totalAddedQty = data.items.length
        lastCost = initialCostPrice
        const now = new Date()
        const stockItemsData = data.items.map((item, index) => ({ barcode: (item.barcode || data.productBarcode || `BAR-${product.id}-${Date.now()}-${index + 1}`).trim(), serialNumber: item.serialNumber ? item.serialNumber.trim() : null, costPrice: itemCosts[index], productId: product.id, branchId: authority.branchId, status: 'IN_STOCK', scannedByEmployeeId: authority.employeeId, receivedAt: now, scannedAt: now }))
        await this.repository.createStockItems({ db: tx, data: stockItemsData })
        await this.repository.createStockMovements({ db: tx, data: stockItemsData.map((item) => ({ productId: product.id, branchId: authority.branchId, qty: 1, type: 'RECEIVE', note: `นำเข้าด่วน (โหมดระบุเลข SN): ${item.serialNumber || item.barcode || 'ไม่มี'}`, createdAt: now })) })
      } else {
        const qty = parseInt(data.lotQuantity)
        if (!qty || qty <= 0) throw Object.assign(new Error('กรุณาระบุจำนวนสินค้าที่ต้องการรับเข้าสต๊อกสำหรับสินค้าประเภทไม่มี SN'), { statusCode: 400, code: 'LOT_QUANTITY_REQUIRED' })
        totalAddedQty = qty
        lastCost = initialCostPrice
        const isolatedBarcode = `${(data.productBarcode || `LOT-${product.id}`).trim()}-B${authority.branchId}`
        const quickLot = await this.repository.createSimpleLot({ db: tx, data: { productId: product.id, branchId: authority.branchId, barcode: isolatedBarcode, qtyInitial: qty, qtyRemaining: qty, unitCost: lastCost, status: 'ACTIVE', receivedAt: new Date() } })
        await this.repository.createStockMovement({ db: tx, data: { productId: product.id, branchId: authority.branchId, qty, type: 'RECEIVE', simpleLotId: quickLot.id, note: `นำเข้าล็อตสินค้าด่วน (SIMPLE Mode) รหัสอ้างอิงคลัง: ${isolatedBarcode}` } })
      }

      await this.repository.upsertStockBalance({ db: tx, productId: product.id, branchId: authority.branchId, quantity: totalAddedQty, lastReceivedCost: lastCost, avgCost: lastCost })
      return { success: true, productId: product.id, productName: product.name }
    }, { timeout: 20000 })
  }

  async quickReceiveExistingProduct(data, actor = {}) {
    const branchId = toInt(actor.branchId)
    const empId = toInt(actor.employeeId)
    const productId = toInt(data?.productId)
    if (!branchId) throw Object.assign(new Error('ไม่พบรหัสสาขาสำหรับทำรายการรับสินค้า'), { statusCode: 401, code: 'BRANCH_ID_MISSING' })
    if (!productId) throw Object.assign(new Error('ไม่พบรหัสสินค้า'), { statusCode: 400, code: 'PRODUCT_ID_MISSING' })

    const runtimePricePayload = { costPrice: data?.costPrice, priceRetail: data?.priceRetail, priceWholesale: data?.priceWholesale, priceTechnician: data?.priceTechnician, priceOnline: data?.priceOnline }
    const authority = priceAuthorityPolicy.assertPricePayload({ actor: { branchId, employeeId: empId, role: actor.role, v2Role: actor.v2Role }, payload: runtimePricePayload })
    const rawItems = Array.isArray(data?.barcodes) ? data.barcodes : Array.isArray(data?.items) ? data.items : []
    const normalizedItems = rawItems.map((item) => typeof item === 'string' ? { barcode: item.trim(), serialNumber: null } : { barcode: String(item?.barcode || item?.code || '').trim(), serialNumber: item?.serialNumber || item?.sn || null }).filter((item) => item.barcode)
    if (!normalizedItems.length) throw Object.assign(new Error('ยังไม่มีรายการบาร์โค้ดสำหรับรับเข้า'), { statusCode: 400, code: 'BARCODE_QUEUE_EMPTY' })

    return this.prisma.$transaction(async (tx) => {
      const product = await this.repository.findProductForReceive({ db: tx, productId, branchId: authority.branchId })
      if (!product) throw Object.assign(new Error('ไม่พบสินค้าภายในสาขาปัจจุบัน'), { statusCode: 404, code: 'PRODUCT_NOT_FOUND_IN_BRANCH' })
      await this.repository.upsertBranchPrice({ db: tx, productId, branchId: authority.branchId, employeeId: authority.employeeId, payload: runtimePricePayload })
      const now = new Date()
      const rows = normalizedItems.map((item) => ({ barcode: item.barcode, serialNumber: item.serialNumber ? String(item.serialNumber).trim() : null, costPrice: Number(runtimePricePayload.costPrice), productId, branchId: authority.branchId, status: 'IN_STOCK', scannedByEmployeeId: authority.employeeId, receivedAt: now, scannedAt: now }))
      await this.repository.createStockItems({ db: tx, data: rows })
      await this.repository.createStockMovements({ db: tx, data: rows.map((row) => ({ productId, branchId: authority.branchId, qty: 1, type: 'RECEIVE', note: `รับเข้าด่วน: ${row.serialNumber || row.barcode}`, createdAt: now })) })
      await this.repository.upsertStockBalance({ db: tx, productId, branchId: authority.branchId, quantity: rows.length, lastReceivedCost: Number(runtimePricePayload.costPrice), avgCost: Number(runtimePricePayload.costPrice) })
      return { success: true, productId, productName: product.name, qty: rows.length }
    }, { timeout: 20000 })
  }
}

module.exports = QuickStockService