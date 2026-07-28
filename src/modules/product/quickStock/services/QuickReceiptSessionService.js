const crypto = require('node:crypto')

const { QuickStockRepository, toInt } = require('../repositories/quickStockRepository')
const { assertProductCanReceive } = require('../../../inventory/policies/productInventoryMutationPolicy')
const { normalizeInputTaxDocumentMode } = require('../../../tax/inputDocuments/contracts/inputTaxDocumentModeContract')

const normalizeDeliveryNote = (value) => String(value || '').trim().replace(/\s+/g, '').toUpperCase()
const cleanText = (value) => String(value || '').trim()
const asMoney = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
const asDate = (value) => (value ? new Date(value) : null)
const makeCode = () => `QR-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
const makeError = (message, statusCode = 400, code = 'QUICK_RECEIPT_ERROR', details) => {
  const error = new Error(message)
  error.statusCode = statusCode
  error.code = code
  if (details) error.details = details
  return error
}

class QuickReceiptSessionService {
  constructor(prisma) {
    this.prisma = prisma
    this.inventory = new QuickStockRepository(prisma)
  }

  async getReceipt(receiptId, branchId, db = this.prisma) {
    const id = toInt(receiptId)
    const brId = toInt(branchId)
    const receipts = await db.$queryRawUnsafe(
      `SELECT r.*, s."name" AS "supplierName"
       FROM "QuickReceiptSession" r
       JOIN "Supplier" s ON s."id" = r."supplierId"
       WHERE r."id" = $1 AND r."branchId" = $2
       LIMIT 1`,
      id,
      brId
    )
    if (!receipts.length) throw makeError('ไม่พบรายการรับสินค้าด่วน', 404, 'QUICK_RECEIPT_NOT_FOUND')

    const items = await db.$queryRawUnsafe(
      `SELECT i.*, p."name" AS "productName", p."mode", p."trackSerialNumber"
       FROM "QuickReceiptSessionItem" i
       JOIN "Product" p ON p."id" = i."productId"
       WHERE i."receiptId" = $1
       ORDER BY i."id" ASC`,
      id
    )

    return { ...receipts[0], items }
  }

  async listReceipts({ branchId, supplierId, deliveryNoteNumber, status = 'DRAFT' } = {}) {
    const brId = toInt(branchId)
    const supplier = toInt(supplierId)
    const normalized = normalizeDeliveryNote(deliveryNoteNumber)
    return this.prisma.$queryRawUnsafe(
      `SELECT r.*, s."name" AS "supplierName",
              COALESCE(COUNT(i."id"), 0)::int AS "itemTypeCount",
              COALESCE(SUM(i."quantity"), 0)::int AS "totalQuantity"
       FROM "QuickReceiptSession" r
       JOIN "Supplier" s ON s."id" = r."supplierId"
       LEFT JOIN "QuickReceiptSessionItem" i ON i."receiptId" = r."id"
       WHERE r."branchId" = $1
         AND ($2::int IS NULL OR r."supplierId" = $2)
         AND ($3::text = '' OR r."normalizedDeliveryNoteNumber" LIKE '%' || $3 || '%')
         AND ($4::text = '' OR r."status" = $4)
       GROUP BY r."id", s."name"
       ORDER BY r."updatedAt" DESC
       LIMIT 100`,
      brId,
      supplier || null,
      normalized,
      cleanText(status).toUpperCase()
    )
  }

  async createDraft(payload, branchId, employeeId) {
    const brId = toInt(branchId)
    const empId = toInt(employeeId)
    const supplierId = toInt(payload?.supplierId)
    const deliveryNoteNumber = cleanText(payload?.deliveryNoteNumber)
    const normalized = normalizeDeliveryNote(deliveryNoteNumber)

    if (!supplierId) throw makeError('กรุณาเลือก Supplier', 400, 'SUPPLIER_REQUIRED')
    if (!normalized) throw makeError('กรุณาระบุเลขที่ใบส่งของ', 400, 'DELIVERY_NOTE_REQUIRED')

    const existing = await this.prisma.$queryRawUnsafe(
      `SELECT "id", "code", "status" FROM "QuickReceiptSession"
       WHERE "branchId" = $1 AND "supplierId" = $2
         AND "normalizedDeliveryNoteNumber" = $3
         AND "status" IN ('DRAFT','FINALIZING','COMPLETED')
       LIMIT 1`,
      brId,
      supplierId,
      normalized
    )
    if (existing.length) {
      const error = makeError('พบรายการรับสินค้าของ Supplier และเลขใบส่งของนี้แล้ว', 409, 'QUICK_RECEIPT_DUPLICATE', existing[0])
      throw error
    }

    const taxMode = normalizeInputTaxDocumentMode(payload?.taxDocumentMode || 'NOT_RECEIVED')
    const created = await this.prisma.$queryRawUnsafe(
      `INSERT INTO "QuickReceiptSession" (
         "code", "branchId", "supplierId", "deliveryNoteNumber", "normalizedDeliveryNoteNumber",
         "deliveryNoteDate", "note", "taxDocumentMode", "supplierTaxInvoiceNumber",
         "supplierTaxInvoiceDate", "taxPricingMode", "documentSubtotal", "documentVatAmount",
         "documentTotalAmount", "createdById", "updatedAt"
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,CURRENT_TIMESTAMP)
       RETURNING *`,
      makeCode(), brId, supplierId, deliveryNoteNumber, normalized,
      asDate(payload?.deliveryNoteDate), cleanText(payload?.note) || null, taxMode,
      cleanText(payload?.supplierTaxInvoiceNumber) || null, asDate(payload?.supplierTaxInvoiceDate),
      cleanText(payload?.taxPricingMode).toUpperCase() || null, asMoney(payload?.documentSubtotal),
      asMoney(payload?.documentVatAmount), asMoney(payload?.documentTotalAmount), empId
    )
    return this.getReceipt(created[0].id, brId)
  }

  async updateDraft(receiptId, payload, branchId) {
    const receipt = await this.getReceipt(receiptId, branchId)
    if (receipt.status !== 'DRAFT') throw makeError('แก้ไขได้เฉพาะรายการสถานะ DRAFT', 409, 'QUICK_RECEIPT_NOT_EDITABLE')

    const supplierId = toInt(payload?.supplierId ?? receipt.supplierId)
    const deliveryNoteNumber = cleanText(payload?.deliveryNoteNumber ?? receipt.deliveryNoteNumber)
    const normalized = normalizeDeliveryNote(deliveryNoteNumber)
    await this.prisma.$queryRawUnsafe(
      `UPDATE "QuickReceiptSession" SET
        "supplierId"=$1, "deliveryNoteNumber"=$2, "normalizedDeliveryNoteNumber"=$3,
        "deliveryNoteDate"=$4, "note"=$5, "taxDocumentMode"=$6,
        "supplierTaxInvoiceNumber"=$7, "supplierTaxInvoiceDate"=$8, "taxPricingMode"=$9,
        "documentSubtotal"=$10, "documentVatAmount"=$11, "documentTotalAmount"=$12,
        "updatedAt"=CURRENT_TIMESTAMP
       WHERE "id"=$13 AND "branchId"=$14`,
      supplierId, deliveryNoteNumber, normalized, asDate(payload?.deliveryNoteDate ?? receipt.deliveryNoteDate),
      cleanText(payload?.note ?? receipt.note) || null,
      normalizeInputTaxDocumentMode(payload?.taxDocumentMode ?? receipt.taxDocumentMode),
      cleanText(payload?.supplierTaxInvoiceNumber ?? receipt.supplierTaxInvoiceNumber) || null,
      asDate(payload?.supplierTaxInvoiceDate ?? receipt.supplierTaxInvoiceDate),
      cleanText(payload?.taxPricingMode ?? receipt.taxPricingMode).toUpperCase() || null,
      asMoney(payload?.documentSubtotal ?? receipt.documentSubtotal),
      asMoney(payload?.documentVatAmount ?? receipt.documentVatAmount),
      asMoney(payload?.documentTotalAmount ?? receipt.documentTotalAmount),
      toInt(receiptId), toInt(branchId)
    )
    return this.getReceipt(receiptId, branchId)
  }

  normalizeItemPayload(payload) {
    const productId = toInt(payload?.productId)
    const costPrice = asMoney(payload?.costPrice)
    const priceRetail = toInt(payload?.priceRetail)
    const rawItems = Array.isArray(payload?.items) ? payload.items : []
    const items = rawItems.map((item) => ({
      barcode: cleanText(item?.barcode),
      serialNumber: cleanText(item?.serialNumber) || null,
    })).filter((item) => item.barcode)
    const quantity = toInt(payload?.quantity) || items.length

    if (!productId) throw makeError('กรุณาระบุสินค้า', 400, 'PRODUCT_REQUIRED')
    if (!costPrice || costPrice <= 0) throw makeError('ราคาทุนต้องมากกว่า 0', 400, 'COST_PRICE_REQUIRED')
    if (!priceRetail || priceRetail <= 0) throw makeError('ราคาขายปลีกต้องมากกว่า 0', 400, 'PRICE_RETAIL_REQUIRED')
    if (!quantity || quantity <= 0) throw makeError('จำนวนรับเข้าต้องมากกว่า 0', 400, 'QUANTITY_REQUIRED')

    return {
      productId, quantity, costPrice, priceRetail,
      priceWholesale: toInt(payload?.priceWholesale),
      priceTechnician: toInt(payload?.priceTechnician),
      priceOnline: toInt(payload?.priceOnline),
      note: cleanText(payload?.note) || null,
      items,
    }
  }

  async addItem(receiptId, payload, branchId) {
    const receipt = await this.getReceipt(receiptId, branchId)
    if (receipt.status !== 'DRAFT') throw makeError('เพิ่มสินค้าได้เฉพาะรายการสถานะ DRAFT', 409, 'QUICK_RECEIPT_NOT_EDITABLE')
    const item = this.normalizeItemPayload(payload)
    await this.prisma.$queryRawUnsafe(
      `INSERT INTO "QuickReceiptSessionItem" (
         "receiptId","productId","quantity","costPrice","priceRetail","priceWholesale",
         "priceTechnician","priceOnline","note","items","updatedAt"
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,CURRENT_TIMESTAMP)`,
      toInt(receiptId), item.productId, item.quantity, item.costPrice, item.priceRetail,
      item.priceWholesale, item.priceTechnician, item.priceOnline, item.note, JSON.stringify(item.items)
    )
    await this.prisma.$executeRawUnsafe(`UPDATE "QuickReceiptSession" SET "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`, toInt(receiptId))
    return this.getReceipt(receiptId, branchId)
  }

  async deleteItem(receiptId, itemId, branchId) {
    const receipt = await this.getReceipt(receiptId, branchId)
    if (receipt.status !== 'DRAFT') throw makeError('ลบสินค้าได้เฉพาะรายการสถานะ DRAFT', 409, 'QUICK_RECEIPT_NOT_EDITABLE')
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "QuickReceiptSessionItem" WHERE "id"=$1 AND "receiptId"=$2`,
      toInt(itemId), toInt(receiptId)
    )
    return this.getReceipt(receiptId, branchId)
  }

  async finalize(receiptId, branchId, employeeId, commandKey) {
    const id = toInt(receiptId)
    const brId = toInt(branchId)
    const empId = toInt(employeeId)
    const key = cleanText(commandKey)
    if (!key) throw makeError('ต้องมี X-Idempotency-Key', 400, 'IDEMPOTENCY_KEY_REQUIRED')

    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRawUnsafe(
        `SELECT * FROM "QuickReceiptSession" WHERE "id"=$1 AND "branchId"=$2 FOR UPDATE`, id, brId
      )
      if (!locked.length) throw makeError('ไม่พบรายการรับสินค้าด่วน', 404, 'QUICK_RECEIPT_NOT_FOUND')
      const receipt = locked[0]
      const existingCommand = await tx.$queryRawUnsafe(
        `SELECT * FROM "QuickReceiptFinalizeCommand" WHERE "branchId"=$1 AND "commandKey"=$2 LIMIT 1`, brId, key
      )
      if (existingCommand.length) return this.getReceipt(existingCommand[0].receiptId, brId, tx)
      if (receipt.status === 'COMPLETED') return this.getReceipt(id, brId, tx)
      if (receipt.status !== 'DRAFT') throw makeError('รายการนี้ไม่อยู่ในสถานะที่ยืนยันได้', 409, 'QUICK_RECEIPT_NOT_FINALIZABLE')

      const items = await tx.$queryRawUnsafe(
        `SELECT * FROM "QuickReceiptSessionItem" WHERE "receiptId"=$1 ORDER BY "id" ASC`, id
      )
      if (!items.length) throw makeError('ยังไม่มีสินค้าในใบรับ', 400, 'RECEIPT_ITEMS_REQUIRED')

      const allBarcodes = []
      const allSerials = []
      for (const line of items) {
        const product = await this.inventory.findOperationalProductInBranch({ db: tx, productId: line.productId, branchId: brId })
        if (!product) throw makeError(`ไม่พบสินค้า ${line.productId} ในสาขาปัจจุบัน`, 404, 'OPERATIONAL_PRODUCT_REQUIRED')
        const policy = assertProductCanReceive(product)
        const units = Array.isArray(line.items) ? line.items : []
        if (policy.mode === 'STRUCTURED' && units.length !== Number(line.quantity)) {
          throw makeError(`จำนวน Barcode ของ ${product.name} ไม่ตรงกับจำนวนรับเข้า`, 400, 'BARCODE_QUANTITY_MISMATCH')
        }
        for (const unit of units) {
          const barcode = cleanText(unit?.barcode)
          const serial = cleanText(unit?.serialNumber)
          if (barcode) allBarcodes.push(barcode)
          if (serial) allSerials.push(serial)
        }
      }

      if (new Set(allBarcodes.map((value) => value.toLowerCase())).size !== allBarcodes.length) {
        throw makeError('พบ Barcode ซ้ำภายในใบรับ', 409, 'DUPLICATE_BARCODE_IN_RECEIPT')
      }
      const { existingBarcodeSet } = await this.inventory.findExistingBarcodes({ db: tx, barcodes: allBarcodes })
      if (existingBarcodeSet.size) throw makeError('พบ Barcode ที่มีอยู่ในระบบแล้ว', 409, 'BARCODE_ALREADY_EXISTS')
      if (new Set(allSerials.map((value) => value.toLowerCase())).size !== allSerials.length) {
        throw makeError('พบ Serial Number ซ้ำภายในใบรับ', 409, 'DUPLICATE_SERIAL_IN_RECEIPT')
      }
      const existingSerials = await this.inventory.findExistingSerialNumbers({ db: tx, serialNumbers: allSerials })
      if (existingSerials.length) throw makeError('พบ Serial Number ที่มีอยู่ในระบบแล้ว', 409, 'SERIAL_ALREADY_EXISTS')

      await tx.$executeRawUnsafe(`UPDATE "QuickReceiptSession" SET "status"='FINALIZING', "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`, id)
      const now = new Date()

      for (const line of items) {
        const product = await this.inventory.findOperationalProductInBranch({ db: tx, productId: line.productId, branchId: brId })
        const policy = assertProductCanReceive(product)
        const qty = Number(line.quantity)
        const cost = Number(line.costPrice)
        const units = Array.isArray(line.items) ? line.items : []
        await this.inventory.upsertBranchPriceManual({
          db: tx, productId: product.id, branchId: brId,
          data: {
            costPrice: cost, priceRetail: line.priceRetail,
            ...(line.priceWholesale != null ? { priceWholesale: line.priceWholesale } : {}),
            ...(line.priceTechnician != null ? { priceTechnician: line.priceTechnician } : {}),
            ...(line.priceOnline != null ? { priceOnline: line.priceOnline } : {}),
            isActive: true,
          },
        })

        let simpleLotId = null
        if (policy.mode === 'STRUCTURED') {
          await this.inventory.createStockItems({ db: tx, data: units.map((unit) => ({
            barcode: cleanText(unit.barcode), serialNumber: cleanText(unit.serialNumber) || null,
            costPrice: cost, productId: product.id, branchId: brId, status: 'IN_STOCK',
            scannedByEmployeeId: empId, receivedAt: now, scannedAt: now, source: 'MANUAL',
            remark: `Quick Receipt ${receipt.code} | Delivery Note ${receipt.deliveryNoteNumber}`,
          })) })
        } else {
          const lot = await this.inventory.createSimpleLot({ db: tx, data: {
            productId: product.id, branchId: brId, barcode: `QR-${id}-${line.id}-${Date.now()}`,
            qtyInitial: qty, qtyRemaining: qty, unitCost: cost, status: 'ACTIVE', receivedAt: now,
          } })
          simpleLotId = lot.id
        }

        await this.inventory.createStockMovement({ db: tx, data: {
          productId: product.id, branchId: brId, qty, type: 'RECEIVE', refType: 'QUICK_RECEIPT',
          refId: id, simpleLotId, performedByEmployeeId: empId,
          note: `Quick Receipt ${receipt.code} | Delivery Note ${receipt.deliveryNoteNumber}`,
          createdAt: now,
        } })
        await this.inventory.upsertStockBalance({ db: tx, productId: product.id, branchId: brId, quantity: qty, lastReceivedCost: cost, avgCost: cost })
      }

      const requestHash = crypto.createHash('sha256').update(`${id}:${brId}:${key}`).digest('hex')
      await tx.$executeRawUnsafe(
        `INSERT INTO "QuickReceiptFinalizeCommand" ("receiptId","branchId","commandKey","requestHash") VALUES ($1,$2,$3,$4)`,
        id, brId, key, requestHash
      )
      await tx.$executeRawUnsafe(
        `UPDATE "QuickReceiptSession" SET "status"='COMPLETED', "completedAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`, id
      )
      return this.getReceipt(id, brId, tx)
    }, { timeout: 30000 })
  }

  async cancel(receiptId, branchId, reason) {
    const receipt = await this.getReceipt(receiptId, branchId)
    if (receipt.status !== 'DRAFT') throw makeError('ยกเลิกได้เฉพาะรายการ DRAFT', 409, 'QUICK_RECEIPT_NOT_CANCELLABLE')
    await this.prisma.$executeRawUnsafe(
      `UPDATE "QuickReceiptSession" SET "status"='CANCELLED', "cancelledAt"=CURRENT_TIMESTAMP,
       "cancelReason"=$1, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2 AND "branchId"=$3`,
      cleanText(reason) || null, toInt(receiptId), toInt(branchId)
    )
    return this.getReceipt(receiptId, branchId)
  }
}

module.exports = QuickReceiptSessionService
