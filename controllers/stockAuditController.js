





// controllers/stockAuditController.js
// ✅ มาตรฐานเดียวกับ branchPriceController / salesReportController
// - ใช้ async arrow functions
// - ตอบกลับด้วย res.status(...).json(...) และใช้คีย์ `message` เมื่อ error (ไม่มี `ok`)
// - ใช้ Prisma singleton จาก ../lib/prisma

const { prisma } = require('../lib/prisma')

// POST /api/stock-audit/ready/start
const startReadyAudit = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId)
    if (!Number.isFinite(branchId)) {
      return res.status(401).json({ message: 'Unauthorized: missing user/branchId' })
    }

    console.log('📌 [startReadyAudit] branchId:', branchId)

    // map employeeId ให้ตรงกับ FK (อ้างอิง EmployeeProfile)
    const employeeId = req.user?.employeeId ?? req.user?.profileId ?? null

    // Guard: Prisma model ต้องพร้อมใช้งาน (กัน schema ไม่ครบ)
    if (!prisma.stockAuditSession || typeof prisma.stockAuditSession.findFirst !== 'function') {
      const models = Object.keys(prisma).filter((k) => typeof prisma[k]?.findMany === 'function')
      console.error('❌ [startReadyAudit] Prisma model "stockAuditSession" not found. Available models:', models)
      return res.status(500).json({ message: 'Prisma model "StockAuditSession" ไม่พบใน Prisma Client. โปรดตรวจ schema.prisma และรัน `npx prisma generate`' })
    }

    const existing = await prisma.stockAuditSession.findFirst({
      where: { branchId, mode: 'READY', confirmedAt: null },

      select: { id: true, expectedCount: true },
    })
    if (existing) {
      return res.status(409).json({ message: 'มีรอบตรวจแบบ DRAFT อยู่แล้ว', sessionId: existing.id, expectedCount: existing.expectedCount })
    }

    const expected = await prisma.stockItem.findMany({
      where: { branchId, status: 'IN_STOCK' },
      select: { id: true, productId: true, barcode: true },
    })
    const expectedCount = expected.length

    const created = await prisma.$transaction(async (tx) => {
      const session = await tx.stockAuditSession.create({
        data: {
          branchId,
          employeeId, // ใช้ค่าที่ map จาก token
          mode: 'READY',
          status: 'DRAFT',
          expectedCount,
          scannedCount: 0,
          startedAt: new Date(),
        },
      })

      if (expectedCount > 0) {
        await tx.stockAuditSnapshotItem.createMany({
          data: expected.map((e) => ({
            auditSessionId: session.id,
            stockItemId: e.id,
            productId: e.productId,
            barcode: e.barcode,
            expectedStatus: 'IN_STOCK',
          })),
          skipDuplicates: true,
        })
      }

      return session
    })

    return res.status(201).json({ sessionId: created.id, expectedCount })
  } catch (error) {
    console.error('❌ [startReadyAudit] error:', error)
    return res.status(500).json({ message: 'ไม่สามารถเริ่มรอบเช็คสต๊อกได้' })
  }
}

// GET /api/stock-audit/:sessionId/overview
const getOverview = async (req, res) => {
  try {
    // ✅ ป้องกัน 304/ETag cache ทำให้ UI ค้างหลัง confirm (ข้อมูลธุรกรรมต้องสดเสมอ)
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    res.set('Surrogate-Control', 'no-store')
    const sessionId = parseInt(req.params.sessionId, 10)
    if (!Number.isFinite(sessionId)) {
      return res.status(400).json({ message: 'sessionId ไม่ถูกต้อง' })
    }

    const s = await prisma.stockAuditSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true, branchId: true, employeeId: true, status: true, mode: true,
        expectedCount: true, scannedCount: true, startedAt: true, confirmedAt: true,
      },
    })
    if (!s) return res.status(404).json({ message: 'ไม่พบรอบเช็คสต๊อก' })

    const branchId = Number(req.user?.branchId)
    if (!Number.isFinite(branchId) || s.branchId !== branchId) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึงรอบนี้' })
    }
    if (s.mode !== 'READY') {
      return res.status(400).json({ message: 'โหมดรอบตรวจไม่ถูกต้อง' })
    }

    const missingCount = Math.max(0, (s.expectedCount || 0) - (s.scannedCount || 0))
    return res.status(200).json({ session: s, missingCount })
  } catch (error) {
    console.error('❌ [getOverview] error:', error)
    return res.status(500).json({ message: 'ไม่สามารถดึงภาพรวมรอบเช็คได้' })
  }
}

// POST /api/stock-audit/:sessionId/scan  { barcode }
const scanBarcode = async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId, 10)
    if (!Number.isFinite(sessionId)) {
      return res.status(400).json({ message: 'sessionId ไม่ถูกต้อง' })
    }

    const session = await prisma.stockAuditSession.findUnique({
      where: { id: sessionId },
      select: { id: true, branchId: true, status: true, mode: true, confirmedAt: true },

    })
    if (!session) return res.status(404).json({ message: 'ไม่พบรอบเช็คสต๊อก' })

    const branchId = Number(req.user?.branchId)
    if (!Number.isFinite(branchId) || session.branchId !== branchId) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึงรอบนี้' })
    }
    if (session.mode !== 'READY') {
      return res.status(400).json({ message: 'โหมดรอบตรวจไม่ถูกต้อง' })
    }
    // ✅ กันการสแกนหลังถูกยืนยัน (อิง confirmedAt เป็นหลัก เพื่อลดความเสี่ยง enum mismatch)
    if (session.confirmedAt) {
      return res.status(409).json({ message: 'รอบนี้ถูกปิดการสแกนแล้ว' })
    }
    // fallback: ถ้ามีสถานะอื่นที่ไม่ใช่ DRAFT ก็ถือว่าปิดการสแกน
    if (session.status && session.status !== 'DRAFT') {
      return res.status(409).json({ message: 'รอบนี้ถูกปิดการสแกนแล้ว' })
    }


    const barcodeRaw = req.body?.barcode ? String(req.body.barcode).trim() : ''
    if (!barcodeRaw) return res.status(400).json({ message: 'กรุณาระบุบาร์โค้ด' })

    // ✅ ให้แน่ใจว่ามี employeeId ที่อ้างอิง employeeProfile จริง ๆ สำหรับ FK byEmployeeId
    let employeeId = req.user?.employeeId ?? null
    if (!employeeId && req.user?.id) {
      const emp = await prisma.employeeProfile.findFirst({ where: { userId: req.user.id }, select: { id: true } })
      employeeId = emp?.id ?? null
    }
    if (!employeeId) {
      return res.status(403).json({ message: 'ไม่พบข้อมูลพนักงานของผู้ใช้งาน (employeeProfile)' })
    }

    const result = await prisma.$transaction(async (tx) => {
      const snap = await tx.stockAuditSnapshotItem.findFirst({
        where: { auditSessionId: sessionId, barcode: barcodeRaw },
        select: { id: true, isScanned: true, stockItemId: true },
      })

      if (!snap) return { status: 422, reason: 'NOT_IN_EXPECTED_SET' }
      if (snap.isScanned) return { status: 409, reason: 'DUPLICATE_SCAN' }

      const updated = await tx.stockAuditSnapshotItem.updateMany({
        where: { id: snap.id, isScanned: false },
        data: { isScanned: true, scannedAt: new Date() },
      })
      if (updated.count !== 1) return { status: 409, reason: 'DUPLICATE_SCAN' }

      const stockItem = await tx.stockItem.findUnique({
        where: { id: snap.stockItemId },
        select: { id: true, barcode: true },
      })
      if (!stockItem) return { status: 500, reason: 'STOCK_ITEM_NOT_FOUND' }

      await tx.stockAuditScanLog.create({
        data: {
          auditSessionId: sessionId,
          stockItemId: stockItem.id,
          barcode: stockItem.barcode,
          byEmployeeId: employeeId,
        },
      })

      await tx.stockAuditSession.update({
        where: { id: sessionId },
        data: { scannedCount: { increment: 1 } },
      })
      

      return { status: 200 }
    })

    if (result.status !== 200) {
      const map = {
        NOT_IN_EXPECTED_SET: 'บาร์โค้ดนี้ไม่อยู่ในชุดคาดหวังของรอบตรวจ',
        DUPLICATE_SCAN: 'บาร์โค้ดนี้ถูกสแกนไปแล้วในรอบนี้',
        STOCK_ITEM_NOT_FOUND: 'ไม่พบข้อมูลสินค้าในสต๊อก',
      }
      return res.status(result.status).json({ message: map[result.reason] || 'เกิดข้อผิดพลาดในการสแกน' })
    }

    return res.status(200).json({ scanned: true })
  } catch (error) {
    console.error('❌ [scanBarcode] error:', error)
    return res.status(500).json({ message: 'สแกนบาร์โค้ดไม่สำเร็จ' })
  }
}

// POST /api/stock-audit/:sessionId/scan-sn  { sn }
const scanSn = async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId, 10)
    if (!Number.isFinite(sessionId)) {
      return res.status(400).json({ message: 'sessionId ไม่ถูกต้อง' })
    }

    const session = await prisma.stockAuditSession.findUnique({
      where: { id: sessionId },
      select: { id: true, branchId: true, status: true, mode: true, confirmedAt: true },
    })
    if (!session) return res.status(404).json({ message: 'ไม่พบรอบเช็คสต๊อก' })

    const branchId = Number(req.user?.branchId)
    if (!Number.isFinite(branchId) || session.branchId !== branchId) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึงรอบนี้' })
    }
    if (session.mode !== 'READY') {
      return res.status(400).json({ message: 'โหมดรอบตรวจไม่ถูกต้อง' })
    }
    // ✅ กันการสแกนหลังถูกยืนยัน (อิง confirmedAt เป็นหลัก เพื่อลดความเสี่ยง enum mismatch)
    if (session.confirmedAt) {
      return res.status(409).json({ message: 'รอบนี้ถูกปิดการสแกนแล้ว' })
    }
    // fallback: ถ้ามีสถานะอื่นที่ไม่ใช่ DRAFT ก็ถือว่าปิดการสแกน
    if (session.status && session.status !== 'DRAFT') {
      return res.status(409).json({ message: 'รอบนี้ถูกปิดการสแกนแล้ว' })
    }

    // รับค่า SN (รองรับทั้ง sn และ serialNumber จาก body)
    const snRaw = req.body?.sn ? String(req.body.sn).trim() : (req.body?.serialNumber ? String(req.body.serialNumber).trim() : '')
    if (!snRaw) return res.status(400).json({ message: 'กรุณาระบุ Serial Number (SN)' })

    // ให้แน่ใจว่ามี employeeId สำหรับอ้าง FK
    let employeeId = req.user?.employeeId ?? null
    if (!employeeId && req.user?.id) {
      const emp = await prisma.employeeProfile.findFirst({ where: { userId: req.user.id }, select: { id: true } })
      employeeId = emp?.id ?? null
    }
    if (!employeeId) {
      return res.status(403).json({ message: 'ไม่พบข้อมูลพนักงานของผู้ใช้งาน (employeeProfile)' })
    }

    const result = await prisma.$transaction(async (tx) => {
      // หา stockItem จาก SN ภายในสาขานี้ และสถานะที่คาดหวัง (IN_STOCK)
      const stockItem = await tx.stockItem.findFirst({
        where: { branchId, status: 'IN_STOCK', serialNumber: snRaw },
        select: { id: true, barcode: true },
      })
      if (!stockItem) return { status: 422, reason: 'SN_NOT_FOUND' }

      // หา snapshot ที่คาดหวังของรอบนี้ด้วย stockItemId
      const snap = await tx.stockAuditSnapshotItem.findFirst({
        where: { auditSessionId: sessionId, stockItemId: stockItem.id },
        select: { id: true, isScanned: true },
      })
      if (!snap) return { status: 422, reason: 'NOT_IN_EXPECTED_SET' }
      if (snap.isScanned) return { status: 409, reason: 'DUPLICATE_SCAN' }

      const updated = await tx.stockAuditSnapshotItem.updateMany({
        where: { id: snap.id, isScanned: false },
        data: { isScanned: true, scannedAt: new Date() },
      })
      if (updated.count !== 1) return { status: 409, reason: 'DUPLICATE_SCAN' }

      await tx.stockAuditScanLog.create({
        data: {
          auditSessionId: sessionId,
          stockItemId: stockItem.id,
          barcode: stockItem.barcode, // เก็บ barcode ควบคู่ (schema เดิมรองรับแน่)
          byEmployeeId: employeeId,
        },
      })

      await tx.stockAuditSession.update({
        where: { id: sessionId },
        data: { scannedCount: { increment: 1 } },
      })

      return { status: 200 }
    })

    if (result.status !== 200) {
      const map = {
        SN_NOT_FOUND: 'ไม่พบ Serial Number นี้ในสต๊อกของสาขา',
        NOT_IN_EXPECTED_SET: 'สินค้านี้ไม่อยู่ในชุดคาดหวังของรอบตรวจ',
        DUPLICATE_SCAN: 'สินค้านี้ถูกสแกนไปแล้วในรอบนี้',
      }
      return res.status(result.status).json({ message: map[result.reason] || 'เกิดข้อผิดพลาดในการสแกน SN' })
    }

    return res.status(200).json({ scanned: true })
  } catch (error) {
    console.error('❌ [scanSn] error:', error)
    return res.status(500).json({ message: 'สแกน SN ไม่สำเร็จ' })
  }
}

// POST /api/stock-audit/:sessionId/cancel  { reason? }
// ✅ Soft-cancel: ปิดรอบแบบ "ยกเลิก" โดยไม่สรุปสูญหาย/ค้างตรวจ และไม่แก้ stockItem ใด ๆ
// ✅ ใช้ confirmedAt เป็น single source of truth สำหรับ "ปิดการสแกน" (หลีกเลี่ยง enum mismatch)
const cancelAudit = async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId, 10)
    if (!Number.isFinite(sessionId)) {
      return res.status(400).json({ message: 'sessionId ไม่ถูกต้อง' })
    }

    const session = await prisma.stockAuditSession.findUnique({
      where: { id: sessionId },
      select: { id: true, branchId: true, status: true, mode: true, confirmedAt: true },
    })
    if (!session) return res.status(404).json({ message: 'ไม่พบรอบเช็คสต๊อก' })

    const branchId = Number(req.user?.branchId)
    if (!Number.isFinite(branchId) || session.branchId !== branchId) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึงรอบนี้' })
    }
    if (session.mode !== 'READY') {
      return res.status(400).json({ message: 'โหมดรอบตรวจไม่ถูกต้อง' })
    }
    // ถ้าปิดรอบไปแล้ว ไม่ให้ยกเลิกซ้ำ
    if (session.confirmedAt) {
      return res.status(409).json({ message: 'รอบนี้ถูกปิดไปแล้ว' })
    }
    // fallback: ถ้ามีสถานะอื่นที่ไม่ใช่ DRAFT ก็ถือว่าปิดรอบแล้ว
    if (session.status && session.status !== 'DRAFT') {
      return res.status(409).json({ message: 'รอบนี้ถูกปิดไปแล้ว' })
    }

    // หมายเหตุ: reason เก็บได้ถ้ามี field รองรับในอนาคต (ตอนนี้ไม่เขียนลง DB เพื่อกัน Prisma validation error)
    // const reason = req.body?.reason ? String(req.body.reason).trim() : ''

    await prisma.stockAuditSession.update({
      where: { id: sessionId },
      // ✅ ปิดรอบด้วย confirmedAt เท่านั้น (ไม่แก้ status เพื่อลดความเสี่ยง enum mismatch)
      data: { confirmedAt: new Date() },
    })

    return res.status(200).json({ ok: true, status: 'CANCELLED' })
  } catch (error) {
    console.error('❌ [cancelAudit] error:', error)
    return res.status(500).json({ message: 'ยกเลิกรอบเช็คไม่สำเร็จ' })
  }
}

// POST /api/stock-audit/:sessionId/confirm  { strategy?: 'MARK_PENDING' | 'MARK_LOST' }
const confirmAudit = async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId, 10)
    if (!Number.isFinite(sessionId)) {
      return res.status(400).json({ message: 'sessionId ไม่ถูกต้อง' })
    }

    const session = await prisma.stockAuditSession.findUnique({
      where: { id: sessionId },
      select: { id: true, branchId: true, status: true, mode: true, confirmedAt: true },
    })
    if (!session) return res.status(404).json({ message: 'ไม่พบรอบเช็คสต๊อก' })

    const branchId = Number(req.user?.branchId)
    if (!Number.isFinite(branchId) || session.branchId !== branchId) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึงรอบนี้' })
    }
    if (session.mode !== 'READY') {
      return res.status(400).json({ message: 'โหมดรอบตรวจไม่ถูกต้อง' })
    }
    // ✅ ใช้ confirmedAt เป็นตัวตัดสินหลัก เพื่อไม่ผูกกับค่า enum
    if (session.confirmedAt) {
      return res.status(409).json({ message: 'รอบนี้ถูกยืนยันไปแล้ว' })
    }
    // fallback: ถ้าสถานะไม่ใช่ DRAFT ก็ถือว่ายืนยันแล้ว/ปิดรอบแล้ว
    if (session.status && session.status !== 'DRAFT') {
      return res.status(409).json({ message: 'รอบนี้ถูกยืนยันไปแล้ว' })
    }

    const strategy = req.body?.strategy || 'MARK_PENDING'
    const targetStatus = strategy === 'MARK_LOST' ? 'LOST' : 'MISSING_PENDING_REVIEW'

    await prisma.$transaction(async (tx) => {
      const missing = await tx.stockAuditSnapshotItem.findMany({
        where: { auditSessionId: sessionId, isScanned: false },
        select: { stockItemId: true },
      })

      if (missing.length > 0) {
        const ids = missing.map((m) => m.stockItemId)
        await tx.stockItem.updateMany({ where: { id: { in: ids } }, data: { status: targetStatus } })
      }

      await tx.stockAuditSession.update({
        where: { id: sessionId },
        // ✅ ไม่ตั้งค่า status ด้วย string ที่อาจไม่อยู่ใน enum (กัน PrismaClientValidationError)
        // ใช้ confirmedAt เป็น single source of truth สำหรับ “ยืนยันผลแล้ว”
        data: { confirmedAt: new Date() },
      })
    })

    return res.status(200).json({ confirmed: true })
  } catch (error) {
    console.error('❌ [confirmAudit] error:', error)
    return res.status(500).json({ message: 'ยืนยันผลการเช็คไม่สำเร็จ' })
  }
}

// GET /api/stock-audit/:sessionId/items?scanned=0|1&q=&page=1&pageSize=50
const listAuditItems = async (req, res) => {
  try {
    // ✅ ป้องกัน 304/ETag cache ทำให้ UI ค้างหลัง confirm (ข้อมูลธุรกรรมต้องสดเสมอ)
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    res.set('Surrogate-Control', 'no-store')
    const sessionId = parseInt(req.params.sessionId, 10)
    if (!Number.isFinite(sessionId)) {
      return res.status(400).json({ message: 'sessionId ไม่ถูกต้อง' })
    }

    const session = await prisma.stockAuditSession.findUnique({
      where: { id: sessionId },
      select: { id: true, branchId: true, mode: true },
    })
    if (!session) return res.status(404).json({ message: 'ไม่พบรอบเช็คสต๊อก' })

    const branchId = Number(req.user?.branchId)
    if (!Number.isFinite(branchId) || session.branchId !== branchId) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึงรอบนี้' })
    }
    if (session.mode !== 'READY') {
      return res.status(400).json({ message: 'โหมดรอบตรวจไม่ถูกต้อง' })
    }

    const scanned = req.query.scanned
    const q = (req.query.q || '').toString().trim()
    const page = Math.max(1, parseInt((req.query.page || '1'), 10))
    const pageSizeRaw = Math.min(200, parseInt((req.query.pageSize || '50'), 10))
    const pageSize = Number.isFinite(pageSizeRaw) ? pageSizeRaw : 50
    const skip = (page - 1) * pageSize

    const where = {
      auditSessionId: sessionId,
      ...(scanned === '0' ? { isScanned: false } : {}),
      ...(scanned === '1' ? { isScanned: true } : {}),
      ...(q
        ? {
          OR: [
            { barcode: { contains: q, mode: 'insensitive' } },
            { stockItem: { serialNumber: { contains: q, mode: 'insensitive' } } },
            { product: { name: { contains: q, mode: 'insensitive' } } },          
          ],
        }
        : {}),
    }

    const [items, total] = await Promise.all([
      prisma.stockAuditSnapshotItem.findMany({
        where,
        select: {
          id: true,
          barcode: true,
          isScanned: true,
          scannedAt: true,
          product: { select: { id: true, name: true } },
          stockItem: { select: { serialNumber: true } },
        },
        orderBy: [{ isScanned: 'asc' }, { id: 'asc' }],
        skip,
        take: pageSize,
      }),
      prisma.stockAuditSnapshotItem.count({ where }),
    ])

    const itemsOut = items.map((it) => ({
      id: it.id,
      barcode: it.barcode,
      serialNumber: it.stockItem?.serialNumber || null,
      isScanned: it.isScanned,
      scannedAt: it.scannedAt,
      product: it.product,
    }))

    return res.status(200).json({ items: itemsOut, total, page, pageSize })
  } catch (error) {
    console.error('❌ [listAuditItems] error:', error)
    return res.status(500).json({ message: 'ไม่สามารถดึงรายการได้' })
  }
}

// GET /api/stock-audit/ready/active
const getActiveReadySession = async (req, res) => {
  try {
    // ✅ active session ต้องสดเสมอ ห้าม browser/proxy cache
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    res.set('Surrogate-Control', 'no-store')
    const branchId = Number(req.user?.branchId)
    if (!Number.isFinite(branchId)) {
      return res.status(401).json({ message: 'Unauthorized: missing branchId' })
    }

    const session = await prisma.stockAuditSession.findFirst({
      where: {
        branchId,
        mode: 'READY',
        confirmedAt: null,
      },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        expectedCount: true,
        scannedCount: true,
        startedAt: true,
      },
    })

    if (!session) {
      return res.status(200).json({ session: null })
    }

    return res.status(200).json({ session })
  } catch (error) {
    console.error('❌ [getActiveReadySession] error:', error)
    return res.status(500).json({ message: 'ไม่สามารถดึง active session ได้' })
  }
}

module.exports = {
  startReadyAudit,
  getOverview,
  scanBarcode,
  scanSn,
  cancelAudit,
  confirmAudit,
  listAuditItems,
  getActiveReadySession,
}













