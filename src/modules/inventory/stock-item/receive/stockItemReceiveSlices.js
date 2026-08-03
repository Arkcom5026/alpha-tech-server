const { prisma, D, toInt, branchIdFrom } = require('../shared/stockItemShared')
const { assertProductCanReceive } = require('../../policies/productInventoryMutationPolicy')

async function receiveStockItem(req, res) {
  try {
    const branchIdFromUser = branchIdFrom(req)
    const { barcode: barcodeData, keepSN } = req.body || {}
    if (!branchIdFromUser) return res.status(401).json({ error: 'unauthorized' })

    const normalized = barcodeData && typeof barcodeData === 'object'
      ? { barcode: barcodeData.barcode, serialNumber: barcodeData.serialNumber }
      : { barcode: barcodeData, serialNumber: undefined }
    const normalizedBarcode = String(normalized.barcode || '').trim()
    const normalizedSerialNumber = String(normalized.serialNumber || '').trim()
    const shouldKeepSN = keepSN === true
    if (!normalizedBarcode) return res.status(400).json({ error: 'Missing or invalid barcode.' })
    if (shouldKeepSN && !normalizedSerialNumber) return res.status(400).json({ error: 'SN is required when keepSN is true.' })

    const barcodeItem = await prisma.barcodeReceiptItem.findUnique({
      where: { barcode: normalizedBarcode },
      include: {
        stockItem: true,
        simpleLot: true,
        receiptItem: {
          include: {
            receipt: true,
            purchaseOrderItem: { include: { product: true, purchaseOrder: { include: { supplier: true } } } },
          },
        },
      },
    })
    if (!barcodeItem) return res.status(404).json({ error: 'Barcode not found.' })

    if (shouldKeepSN && normalizedSerialNumber) {
      const duplicateSN = await prisma.stockItem.findFirst({ where: { serialNumber: normalizedSerialNumber }, select: { id: true, barcode: true, branchId: true } })
      if (duplicateSN) return res.status(409).json({ code: 'DUPLICATE_SERIAL_NUMBER', message: 'SN นี้ถูกใช้ไปแล้วในระบบ' })
    }

    const product = barcodeItem.receiptItem?.purchaseOrderItem?.product
    const purchaseOrder = barcodeItem.receiptItem?.purchaseOrderItem?.purchaseOrder
    if (!product || !purchaseOrder) return res.status(400).json({ error: 'Product or PO data missing.' })
    try {
      assertProductCanReceive(product)
    } catch (error) {
      return res.status(error.statusCode || 400).json({ code: error.code, message: error.message })
    }
    const branchId = toInt(barcodeItem.receiptItem?.receipt?.branchId)
    if (!branchId || branchId !== branchIdFromUser) return res.status(403).json({ error: 'คุณไม่มีสิทธิ์รับสินค้าของสาขาอื่น' })

    const isLot = barcodeItem.kind === 'LOT' || barcodeItem.simpleLotId != null
    if (isLot) {
      if (barcodeItem.simpleLotId != null || barcodeItem.simpleLot != null) {
        return res.status(200).json({ message: 'LOT already scanned', lot: { barcode: barcodeItem.barcode, receiptItemId: barcodeItem.receiptItemId, quantity: toInt(barcodeItem.receiptItem?.quantity) || 0 } })
      }
      const quantity = toInt(barcodeItem.receiptItem?.quantity) || 0
      const totalCost = D(barcodeItem.receiptItem?.costPrice || 0).times(quantity || 1)
      const result = await prisma.$transaction(async (tx) => {
        const lot = await tx.simpleLot.create({
          data: {
            productId: product.id,
            branchId,
            receiptItemId: barcodeItem.receiptItem.id,
            barcode: barcodeItem.barcode,
            qtyInitial: quantity,
            qtyRemaining: quantity,
            unitCost: barcodeItem.receiptItem?.costPrice || 0,
            status: 'ACTIVE',
          },
        })
        const updatedBRI = await tx.barcodeReceiptItem.update({
          where: { id: barcodeItem.id },
          data: { status: 'SN_RECEIVED', simpleLotId: lot.id },
        })
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            branchId,
            qty: quantity,
            type: 'RECEIVE',
            simpleLotId: lot.id,
            refType: 'PURCHASE_RECEIPT',
            refId: barcodeItem.receiptItem?.receiptId || null,
            note: `รับสินค้า SIMPLE จาก LOT ${barcodeItem.barcode}`,
          },
        })
        await tx.stockBalance.upsert({
          where: { productId_branchId: { productId: product.id, branchId } },
          update: { quantity: { increment: quantity } },
          create: { productId: product.id, branchId, quantity, reserved: 0 },
        })
        if (!purchaseOrder.supplier?.isSystem && totalCost.gt(0)) {
          await tx.supplier.update({
            where: { id: purchaseOrder.supplierId },
            data: { creditBalance: D(purchaseOrder.supplier.creditBalance || 0).plus(totalCost) },
          })
        }
        return { updatedBRI }
      }, { timeout: 20000 })
      return res.status(200).json({
        message: '✅ LOT scanned and ready to sell.',
        lot: { barcode: barcodeItem.barcode, receiptItemId: barcodeItem.receiptItemId, quantity },
        result,
      })
    }

    if (barcodeItem.stockItem?.id) return res.status(200).json({ message: 'Item already received', stockItemId: barcodeItem.stockItem.id })
    const duplicateBarcode = await prisma.stockItem.findUnique({ where: { barcode: normalizedBarcode } })
    if (duplicateBarcode) return res.status(200).json({ message: 'Item already received', stockItemId: duplicateBarcode.id })

    const stockItem = await prisma.$transaction(async (tx) => {
      const created = await tx.stockItem.create({
        data: {
          barcode: normalizedBarcode,
          serialNumber: shouldKeepSN ? normalizedSerialNumber : null,
          status: 'IN_STOCK', receivedAt: new Date(), costPrice: D(barcodeItem.receiptItem?.costPrice || 0),
          product: { connect: { id: product.id } }, branch: { connect: { id: branchId } },
          purchaseOrderReceiptItem: { connect: { id: barcodeItem.receiptItem.id } },
        },
      })
      await tx.barcodeReceiptItem.update({ where: { id: barcodeItem.id }, data: { status: 'SN_RECEIVED', stockItem: { connect: { id: created.id } } } })
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          branchId,
          stockItemId: created.id,
          qty: 1,
          type: 'RECEIVE',
          refType: 'PURCHASE_RECEIPT',
          refId: barcodeItem.receiptItem?.receiptId || null,
          note: `รับสินค้า STRUCTURED จาก Barcode ${normalizedBarcode}`,
        },
      })
      await tx.stockBalance.upsert({
        where: { productId_branchId: { productId: product.id, branchId } },
        update: { quantity: { increment: 1 } },
        create: { productId: product.id, branchId, quantity: 1, reserved: 0 },
      })
      const itemCost = D(barcodeItem.receiptItem?.costPrice || 0)
      if (!purchaseOrder.supplier?.isSystem && itemCost.gt(0)) {
        await tx.supplier.update({
          where: { id: purchaseOrder.supplierId },
          data: { creditBalance: D(purchaseOrder.supplier.creditBalance || 0).plus(itemCost) },
        })
      }
      return created
    }, { timeout: 20000 })
    return res.status(201).json({ message: '✅ รับสินค้าเข้าสต๊อกเรียบร้อยแล้ว', stockItem })
  } catch (error) {
    console.error('[receiveStockItem] ❌ Unexpected error:', error)
    return res.status(500).json({ error: 'Internal server error.' })
  }
}

async function receiveAllPendingNoSN(req, res) {
  try {
    const branchId = branchIdFrom(req)
    const receiptId = toInt(req.body?.receiptId)
    if (!branchId) return res.status(401).json({ error: 'unauthorized' })
    if (!receiptId) return res.status(400).json({ error: 'receiptId ไม่ถูกต้อง' })

    const receipt = await prisma.purchaseOrderReceipt.findFirst({
      where: { id: receiptId, branchId },
      include: {
        purchaseOrder: { include: { supplier: true } },
        items: {
          include: {
            purchaseOrderItem: { include: { product: true } },
            barcodeReceiptItem: { include: { stockItem: true, simpleLot: true }, orderBy: { id: 'asc' } },
          },
          orderBy: { id: 'asc' },
        },
      },
    })
    if (!receipt) return res.status(404).json({ error: 'ไม่พบใบรับสินค้านี้ในสาขา' })

    const pendingEntries = []
    for (const item of receipt.items || []) {
      for (const barcodeItem of item.barcodeReceiptItem || []) {
        const product = item?.product || item?.purchaseOrderItem?.product
        const alreadyReceived = Boolean(barcodeItem.stockItem?.id) || Boolean(barcodeItem.simpleLotId) || barcodeItem.status === 'SN_RECEIVED'
        if (!alreadyReceived) pendingEntries.push({
          id: barcodeItem.id, barcode: barcodeItem.barcode, receiptItemId: barcodeItem.receiptItemId,
          quantity: D(item.quantity || 0), costPrice: D(item.costPrice || 0), productId: product?.id,
          productMode: String(product?.mode || '').toUpperCase(),
          inventoryBehavior: product?.inventoryBehavior,
          productNoSN: product?.noSN,
          trackSerialNumber: product?.trackSerialNumber,
        })
      }
    }
    if (!pendingEntries.length) return res.status(200).json({ message: 'ไม่มีรายการค้างรับ', receivedCount: 0, receiptId })

    try {
      pendingEntries.forEach((entry) => assertProductCanReceive({
        mode: entry.productMode,
        inventoryBehavior: entry.inventoryBehavior,
        noSN: entry.productNoSN,
        trackSerialNumber: entry.trackSerialNumber,
      }))
    } catch (error) {
      return res.status(error.statusCode || 400).json({ code: error.code, message: error.message })
    }

    const supplier = receipt.purchaseOrder?.supplier
    const supplierId = receipt.purchaseOrder?.supplierId
    const result = await prisma.$transaction(async (tx) => {
      let receivedCount = 0
      let totalCreditIncrement = D(0)
      for (const entry of pendingEntries) {
        const unitCost = D(entry.costPrice || 0)
        if (entry.productMode === 'STRUCTURED') {
          const created = await tx.stockItem.create({
            data: {
              barcode: String(entry.barcode), serialNumber: null, status: 'IN_STOCK', receivedAt: new Date(), costPrice: unitCost,
              product: { connect: { id: entry.productId } }, branch: { connect: { id: branchId } },
              purchaseOrderReceiptItem: { connect: { id: entry.receiptItemId } },
            },
          })
          await tx.barcodeReceiptItem.update({ where: { id: entry.id }, data: { status: 'SN_RECEIVED', stockItem: { connect: { id: created.id } } } })
          await tx.stockMovement.create({
            data: {
              productId: entry.productId,
              branchId,
              stockItemId: created.id,
              qty: 1,
              type: 'RECEIVE',
              refType: 'PURCHASE_RECEIPT',
              refId: receiptId,
              note: `รับสินค้า STRUCTURED จาก Barcode ${entry.barcode}`,
            },
          })
          await tx.stockBalance.upsert({
            where: { productId_branchId: { productId: entry.productId, branchId } },
            update: { quantity: { increment: 1 } }, create: { productId: entry.productId, branchId, quantity: 1, reserved: 0 },
          })
          totalCreditIncrement = totalCreditIncrement.plus(unitCost)
        } else {
          const quantity = D(entry.quantity || 0)
          const lot = await tx.simpleLot.create({
            data: {
              productId: entry.productId,
              branchId,
              receiptItemId: entry.receiptItemId,
              barcode: String(entry.barcode),
              qtyInitial: quantity,
              qtyRemaining: quantity,
              unitCost,
              status: 'ACTIVE',
            },
          })
          await tx.barcodeReceiptItem.update({
            where: { id: entry.id },
            data: { status: 'SN_RECEIVED', simpleLotId: lot.id },
          })
          await tx.stockMovement.create({
            data: {
              productId: entry.productId,
              branchId,
              qty: quantity,
              type: 'RECEIVE',
              simpleLotId: lot.id,
              refType: 'PURCHASE_RECEIPT',
              refId: receiptId,
              note: `รับสินค้า SIMPLE จาก LOT ${entry.barcode}`,
            },
          })
          await tx.stockBalance.upsert({
            where: { productId_branchId: { productId: entry.productId, branchId } },
            update: { quantity: { increment: quantity } }, create: { productId: entry.productId, branchId, quantity, reserved: 0 },
          })
          totalCreditIncrement = totalCreditIncrement.plus(unitCost.times(quantity))
        }
        receivedCount += 1
      }
      if (!supplier?.isSystem && supplierId && totalCreditIncrement.gt(0)) {
        await tx.supplier.update({ where: { id: supplierId }, data: { creditBalance: D(supplier?.creditBalance || 0).plus(totalCreditIncrement) } })
      }
      return { receivedCount, totalCreditIncrement: totalCreditIncrement.toString() }
    }, { timeout: 20000 })

    return res.status(200).json({
      message: 'รับสินค้าค้างรับทั้งหมดสำเร็จ', receiptId, receivedCount: result.receivedCount,
      totalCreditIncrement: result.totalCreditIncrement, barcodes: pendingEntries.map((entry) => entry.barcode),
    })
  } catch (error) {
    console.error('[receiveAllPendingNoSN] ❌', error)
    return res.status(500).json({ error: 'ไม่สามารถรับสินค้าค้างรับทั้งหมดได้' })
  }
}

module.exports = { receiveStockItem, receiveAllPendingNoSN }
