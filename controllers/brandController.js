


// controllers/brandController.js — Prisma singleton + validations + safer errors

const { prisma, Prisma } = require('../lib/prisma')

// ===== helpers =====
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v))

const normalizeName = (name) => String(name || '').trim()

// Normalized key for unique constraint (Brand.normalizedName)
// - trim
// - collapse whitespace
// - lowercase
const normalizeKey = (name) =>
  normalizeName(name)
    .replace(/\s+/g, ' ')
    .toLowerCase()

const sendError = (res, err, fallbackMessage) => {
  console.error('❌ [brandController] error:', err)
  const status = err?.status || 500
  const message = err?.message || fallbackMessage || 'เกิดข้อผิดพลาด'
  return res.status(status).json({ message })
}

// ===== controllers =====

// GET /brands?page=1&pageSize=20&includeInactive=false&q=...
exports.listBrands = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    const includeInactive = String(req.query.includeInactive || 'false') === 'true'

    const page = Math.max(1, parseInt(req.query.page || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)))
    const skip = (page - 1) * pageSize

    const where = {
      ...(includeInactive ? {} : { active: true }),
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.brand.findMany({
        where,
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
        skip,
        take: pageSize,
        select: { id: true, name: true, normalizedName: true, active: true, createdAt: true, updatedAt: true },
      }),
      prisma.brand.count({ where }),
    ])

    return res.json({ items, page, pageSize, total })
  } catch (err) {
    return sendError(res, err, 'เกิดข้อผิดพลาดในการดึงข้อมูลแบรนด์')
  }
}

// GET /brands/dropdowns?includeInactive=false&q=...&productTypeId=123
// - For dropdown usage (no pagination)
// - Returns array only (lighter payload)
// - Assistive filter by productTypeId (auto-learn mapping)
//   - If mapping exists for productTypeId → filter brands by mapping
//   - If mapping does NOT exist yet → fallback to all brands (avoid blocking user)
exports.listBrandDropdowns = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    const includeInactive = String(req.query.includeInactive || 'false') === 'true'
    const productTypeId = toInt(req.query.productTypeId)

    const whereBase = {
      ...(includeInactive ? {} : { active: true }),
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    }

    let where = whereBase

    // ✅ Assistive filter: only apply when mapping exists
    if (productTypeId) {
      const mapCount = await prisma.productTypeBrand.count({
        where: { productTypeId: Number(productTypeId) },
      })

      if (mapCount > 0) {
        // Requires Prisma back-relation: Brand.typeBrands -> ProductTypeBrand[]
        where = {
          ...whereBase,
          typeBrands: {
            some: { productTypeId: Number(productTypeId) },
          },
        }
      }
      // else fallback to whereBase (no filter)
    }

    const items = await prisma.brand.findMany({
      where,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, active: true },
    })

    // Return array only (as contract for dropdown)
    return res.json(items)
  } catch (err) {
    return sendError(res, err, 'เกิดข้อผิดพลาดในการดึงข้อมูลแบรนด์สำหรับ dropdown')
  }
}

// POST /brands { name }
exports.createBrand = async (req, res) => {
  try {
    const name = normalizeName(req.body?.name)
    if (!name) return res.status(400).json({ message: 'กรุณาระบุชื่อแบรนด์' })

    const normalizedName = normalizeKey(name)

    try {
      const created = await prisma.brand.create({
        data: { name, normalizedName, active: true },
        select: { id: true, name: true, normalizedName: true, active: true, createdAt: true, updatedAt: true },
      })
      return res.status(201).json(created)
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return res.status(409).json({ message: 'ชื่อแบรนด์ซ้ำ (unique constraint)' })
      }
      throw e
    }
  } catch (err) {
    return sendError(res, err, 'ไม่สามารถสร้างแบรนด์ได้')
  }
}

// PUT /brands/:id { name }
exports.updateBrand = async (req, res) => {
  try {
    const id = toInt(req.params?.id)
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' })

    const name = normalizeName(req.body?.name)
    if (!name) return res.status(400).json({ message: 'กรุณาระบุชื่อแบรนด์' })

    const normalizedName = normalizeKey(name)

    try {
      const updated = await prisma.brand.update({
        where: { id },
        data: { name, normalizedName },
        select: { id: true, name: true, normalizedName: true, active: true, createdAt: true, updatedAt: true },
      })
      return res.json(updated)
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        return res.status(404).json({ message: 'ไม่พบแบรนด์ที่ต้องการแก้ไข' })
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return res.status(409).json({ message: 'ชื่อแบรนด์ซ้ำ (unique constraint)' })
      }
      throw e
    }
  } catch (err) {
    return sendError(res, err, 'ไม่สามารถแก้ไขแบรนด์ได้')
  }
}

// PATCH /brands/:id/toggle { active?: boolean, isActive?: boolean }
exports.toggleBrand = async (req, res) => {
  try {
    const id = toInt(req.params?.id)
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' })

    const nextActiveRaw =
      req.body?.active !== undefined ? req.body.active : req.body?.isActive !== undefined ? req.body.isActive : undefined

    const active = nextActiveRaw === undefined ? undefined : !!nextActiveRaw
    if (active === undefined) return res.status(400).json({ message: 'กรุณาระบุสถานะ active' })

    try {
      const updated = await prisma.brand.update({
        where: { id },
        data: { active },
        select: { id: true, name: true, normalizedName: true, active: true, createdAt: true, updatedAt: true },
      })
      return res.json(updated)
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        return res.status(404).json({ message: 'ไม่พบแบรนด์ที่ต้องการเปลี่ยนสถานะ' })
      }
      throw e
    }
  } catch (err) {
    return sendError(res, err, 'ไม่สามารถเปลี่ยนสถานะแบรนด์ได้')
  }
}






