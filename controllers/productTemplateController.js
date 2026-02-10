


// productTemplateController.js — BestLine aligned (ProductProfile not tied to ProductType/Category)
// Guards: normalize + global unique (slug/normalizedName), archive/restore, safer P2002

const { prisma } = require('../lib/prisma')
const MAX_LIMIT = 100

// ---------- helpers ----------
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v))
const omitUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))

// Inline normalizer (align with other controllers)
const toSpaces = (s) => s.replace(/[_-]+/g, ' ').replace(/[ ]+/g, ' ').trim()
const stripPunct = (s) => s.replace(/[^A-Za-z0-9ก-๙ .]/g, '')
function normalizeName(raw) {
  if (!raw) return ''
  let s = String(raw).normalize('NFC')
  s = toSpaces(stripPunct(s)).toLowerCase()
  return s
}
function slugify(raw) {
  if (!raw) return ''
  const base = normalizeName(raw)
  return base.replace(/[.]/g, '').replace(/[ ]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

// ---------- parent guard ----------
async function getProfileGuardInfo(productProfileId) {
  if (!productProfileId) return null
  // BestLine: ProductProfile is NOT tied to ProductType/Category
  return prisma.productProfile.findUnique({
    where: { id: productProfileId },
    select: { id: true, active: true },
  })
}

// ---------- queries ----------
async function findDuplicateTemplate({ normalizedName, slug }) {
  if (!normalizedName && !slug) return null
  return prisma.productTemplate.findFirst({
    where: {
      OR: [
        ...(normalizedName ? [{ normalizedName }] : []),
        ...(slug ? [{ slug }] : []),
      ],
    },
    select: { id: true, name: true, slug: true, normalizedName: true, pathCached: true, productProfileId: true },
  })
}

// ✅ GET /product-templates — list (คงรูปแบบเดิม)
const getAllProductTemplates = async (req, res) => {
  try {
    // NOTE: productTypeId/categoryId ถูกถอดออกตาม BestLine (ProductProfile ไม่ผูก ProductType/Category)
    const { q, includeInactive, page: pageQ, limit: limitQ } = req.query || {}

    const pageRaw = Number(pageQ)
    const limitRaw = Number(limitQ)
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : 20

    const where = omitUndefined({      ...((String(includeInactive || '').toLowerCase() === 'true') ? {} : { active: true }),
      ...(q
        ? {
            OR: [
              { name: { contains: String(q), mode: 'insensitive' } },
              
            ],
          }
        : {}),
    })

    const [totalItems, items] = await Promise.all([
      prisma.productTemplate.count({ where }),
      prisma.productTemplate.findMany({
        where,
        include: {
          productProfile: true,
          unit: true,
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    const mapped = items.map((t) => ({
      id: t.id,
      name: t.name,
      unitId: t.unitId,
      unitName: t.unit?.name ?? '-',
      productProfileName: t.productProfile?.name ?? '-',
      productProfileId: t.productProfile?.id ?? null,
    }))

    res.set('Cache-Control', 'no-store')
    const totalPages = Math.max(1, Math.ceil(totalItems / limit))

    res.json({ items: mapped, totalItems, totalPages, page, limit })
  } catch (error) {
    console.error('❌ getAllProductTemplates error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ✅ POST /product-templates — create with normalize + global unique guard
const createProductTemplate = async (req, res) => {
  try {
    const { name, productProfileId, unitId } = req.body || {}

    // คง behavior เดิม: require productProfileId + unitId (แม้ schema จะ optional)
    if (!name || !toInt(productProfileId) || !toInt(unitId)) {
      return res.status(400).json({ error: 'ต้องระบุ name, productProfileId และ unitId ให้ถูกต้อง' })
    }

    const productProfileIdInt = toInt(productProfileId)
    const unitIdInt = toInt(unitId)

    const [pfGuard, unit] = await Promise.all([
      getProfileGuardInfo(productProfileIdInt),
      prisma.unit.findUnique({ where: { id: unitIdInt }, select: { id: true } }),
    ])

    if (!pfGuard) return res.status(404).json({ error: 'ไม่พบ productProfile' })
    if (!unit) return res.status(404).json({ error: 'ไม่พบหน่วยนับ (unit)' })

    // parent guards (BestLine: only check ProductProfile active)
    if (pfGuard.active === false) {
      return res.status(409).json({ error: 'PARENT_INACTIVE', message: 'โปรไฟล์ถูกปิดการใช้งานอยู่ กรุณากู้คืนก่อน' })
    }

    const nameTrim = String(name).trim()
    if (!nameTrim) return res.status(400).json({ error: 'ชื่อห้ามว่าง' })
    if (nameTrim.length > 80) return res.status(400).json({ error: 'ชื่อยาวเกินไป (สูงสุด 80 ตัวอักษร)' })

    const normalized = normalizeName(nameTrim)
    const slug = slugify(nameTrim)

    // Global uniqueness (schema: @@unique([slug]) and @@unique([normalizedName]))
    const dupe = await findDuplicateTemplate({ normalizedName: normalized, slug })
    if (dupe) {
      return res.status(409).json({
        error: 'DUPLICATE',
        message: 'พบรายการเดิม (global unique: slug/normalizedName)',
        level: 'template',
        conflict: dupe,
      })
    }

    const created = await prisma.productTemplate.create({
      data: {
        name: nameTrim,
        normalizedName: normalized,
        slug,
        unitId: unitIdInt,
        productProfileId: productProfileIdInt,
        active: true,
      },
      include: {
        unit: true,
        productProfile: true,
      },
    })

    res.status(201).json(created)
  } catch (error) {
    console.error('❌ createProductTemplate error:', error)
    if (error?.code === 'P2002') {
      try {
        const nameTrim = String(req.body?.name || '').trim()
        const normalized = req.body?.normalizedName || normalizeName(nameTrim)
        const slug = req.body?.slug || slugify(nameTrim)
        const dupe = await findDuplicateTemplate({ normalizedName: normalized, slug })
        return res.status(409).json({
          error: 'DUPLICATE',
          message: 'พบรายการเดิม (global unique: slug/normalizedName)',
          level: 'template',
          conflict: dupe || null,
        })
      } catch (_) {}
    }
    res.status(500).json({ error: 'Failed to create template' })
  }
}

// ✅ PATCH /product-templates/:id — update with normalize + global unique guard
const updateProductTemplate = async (req, res) => {
  try {
    const id = toInt(req.params.id)
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' })

    const { name, productProfileId, unitId } = req.body || {}

    // current row
    const current = await prisma.productTemplate.findUnique({
      where: { id },
      select: { id: true, productProfileId: true },
    })
    if (!current) return res.status(404).json({ error: 'ไม่พบ template ที่ต้องการอัปเดต' })

    // validate provided refs (คงแนวเดิม)
    const productProfileIdInt = toInt(productProfileId)
    const unitIdInt = toInt(unitId)

    if (productProfileId !== undefined) {
      if (!productProfileIdInt) return res.status(400).json({ error: 'productProfileId ไม่ถูกต้อง' })
      const targetGuard = await getProfileGuardInfo(productProfileIdInt)
      if (!targetGuard) return res.status(404).json({ error: 'ไม่พบ productProfile' })
      if (targetGuard.active === false) {
        return res.status(409).json({ error: 'PARENT_INACTIVE', message: 'โปรไฟล์ปลายทางถูกปิดการใช้งานอยู่ กรุณากู้คืนก่อน' })
      }
    }

    if (unitId !== undefined) {
      if (!unitIdInt) return res.status(400).json({ error: 'unitId ไม่ถูกต้อง' })
      const un = await prisma.unit.findUnique({ where: { id: unitIdInt }, select: { id: true } })
      if (!un) return res.status(404).json({ error: 'ไม่พบหน่วยนับ (unit)' })
    }

    // prepare name changes & proactive global duplicate check
    let nameTrim, normalized, slug
    if (name !== undefined) {
      if (String(name).trim() === '') return res.status(400).json({ error: 'ชื่อห้ามว่าง' })
      if (String(name).trim().length > 80) return res.status(400).json({ error: 'ชื่อยาวเกินไป (สูงสุด 80 ตัวอักษร)' })
      nameTrim = String(name).trim()
      normalized = normalizeName(nameTrim)
      slug = slugify(nameTrim)

      const dupe = await findDuplicateTemplate({ normalizedName: normalized, slug })
      if (dupe && dupe.id !== id) {
        return res.status(409).json({
          error: 'DUPLICATE',
          message: 'พบรายการเดิม (global unique: slug/normalizedName)',
          level: 'template',
          conflict: dupe,
        })
      }
    }

    const data = omitUndefined({
      name: nameTrim,
      normalizedName: normalized,
      slug,
      productProfileId: productProfileIdInt !== undefined && productProfileIdInt !== current.productProfileId ? productProfileIdInt : undefined,
      unitId: unitIdInt,
    })

    const updated = await prisma.productTemplate.update({
      where: { id },
      data,
      include: {
        unit: true,
        productProfile: true,
      },
    })

    res.json(updated)
  } catch (error) {
    console.error('❌ updateProductTemplate error:', error)
    if (error?.code === 'P2025') return res.status(404).json({ error: 'ไม่พบ template ที่ต้องการอัปเดต' })
    if (error?.code === 'P2002') {
      try {
        const nameTrim = String(req.body?.name || '').trim()
        const normalized = req.body?.normalizedName || normalizeName(nameTrim)
        const slug = req.body?.slug || slugify(nameTrim)
        const dupe = await findDuplicateTemplate({ normalizedName: normalized, slug })
        return res.status(409).json({
          error: 'DUPLICATE',
          message: 'พบรายการเดิม (global unique: slug/normalizedName)',
          level: 'template',
          conflict: dupe || null,
        })
      } catch (_) {}
    }
    res.status(500).json({ error: 'Failed to update product template' })
  }
}

// ✅ ARCHIVE — set active=false (block if referenced by product)
const archiveProductTemplate = async (req, res) => {
  try {
    const id = toInt(req.params.id)
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' })

    const current = await prisma.productTemplate.findUnique({
      where: { id },
      select: { id: true, active: true },
    })
    if (!current) return res.status(404).json({ error: 'ไม่พบเทมเพลตสินค้าที่ต้องการปิดการใช้งาน' })

    const usedByProduct = await prisma.product.findFirst({ where: { templateId: id } })
    if (usedByProduct) {
      return res.status(409).json({ error: 'HAS_REFERENCES', message: 'มีการอ้างอิงอยู่ (product)' })
    }

    if (current.active === false) return res.json({ message: 'เทมเพลตนี้ถูกปิดการใช้งานอยู่แล้ว', id })

    await prisma.productTemplate.update({ where: { id }, data: { active: false } })
    return res.json({ message: 'ปิดการใช้งานเทมเพลตสินค้าเรียบร้อย', id })
  } catch (error) {
    console.error('❌ ARCHIVE ProductTemplate Failed:', error)
    if (error?.code === 'P2025') return res.status(404).json({ error: 'ไม่พบเทมเพลตสินค้าที่ต้องการปิดการใช้งาน' })
    return res.status(500).json({ error: 'ไม่สามารถปิดการใช้งานเทมเพลตสินค้าได้' })
  }
}

// ✅ RESTORE — set active=true
const restoreProductTemplate = async (req, res) => {
  try {
    const id = toInt(req.params.id)
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' })

    const current = await prisma.productTemplate.findUnique({
      where: { id },
      select: { id: true, active: true, productProfileId: true },
    })
    if (!current) return res.status(404).json({ error: 'ไม่พบเทมเพลตสินค้าที่ต้องการกู้คืน' })

    // parent guards: only ProductProfile active
    if (current.productProfileId) {
      const guard = await getProfileGuardInfo(current.productProfileId)
      if (guard?.active === false) {
        return res.status(409).json({ error: 'PARENT_INACTIVE', message: 'โปรไฟล์ถูกปิดการใช้งานอยู่ กรุณากู้คืนก่อน' })
      }
    }

    if (current.active === true) return res.json({ message: 'เทมเพลตนี้อยู่ในสถานะใช้งานแล้ว', id })

    await prisma.productTemplate.update({ where: { id }, data: { active: true } })
    return res.json({ message: 'กู้คืนเทมเพลตสินค้าเรียบร้อย', id })
  } catch (error) {
    console.error('❌ RESTORE ProductTemplate Failed:', error)
    if (error?.code === 'P2025') return res.status(404).json({ error: 'ไม่พบเทมเพลตสินค้าที่ต้องการกู้คืน' })
    return res.status(500).json({ error: 'ไม่สามารถกู้คืนเทมเพลตสินค้าได้' })
  }
}

// ✅ GET /product-templates/:id — single
const getProductTemplateById = async (req, res) => {
  try {
    const id = toInt(req.params.id)
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' })

    const template = await prisma.productTemplate.findUnique({
      where: { id },
      include: {
        unit: true,
        productProfile: true,
      },
    })

    if (!template) return res.status(404).json({ error: 'ไม่พบข้อมูล' })

    res.json(template)
  } catch (error) {
    console.error('❌ getProductTemplateById error:', error)
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลได้' })
  }
}

// (ยังคงไว้เพื่อ Backward-Compatible หากส่วนอื่นในระบบยังเรียกใช้อยู่)
const deleteProductTemplate = async (req, res) => {
  try {
    const id = toInt(req.params.id)
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' })

    const usedInProduct = await prisma.product.findFirst({ where: { templateId: id } })
    const usedInStock = await prisma.stockItem.findFirst({ where: { product: { templateId: id } } })
    if (usedInProduct || usedInStock) {
      return res.status(409).json({ error: 'ไม่สามารถลบได้ เพราะมีการใช้งานแล้ว' })
    }

    await prisma.productTemplate.delete({ where: { id } })
    res.json({ message: 'Deleted successfully' })
  } catch (error) {
    console.error('❌ deleteProductTemplate error:', error)
    if (error?.code === 'P2025') return res.status(404).json({ error: 'ไม่พบ template ที่ต้องการลบ' })
    if (error?.code === 'P2003') return res.status(409).json({ error: 'ลบไม่ได้ มีการอ้างอิงอยู่ (foreign key constraint)' })
    res.status(500).json({ error: 'Failed to delete template' })
  }
}

// ✅ DROPDOWNS — return only active=true (optional filter by productProfileId)
const getProductTemplateDropdowns = async (req, res) => {
  try {
    const { productProfileId, q, includeInactive, limit: limitQ } = req.query || {}

    const limitRaw = Number(limitQ)
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : 100

    const where = omitUndefined({
      ...((String(includeInactive || '').toLowerCase() === 'true') ? {} : { active: true }),
      ...(toInt(productProfileId) ? { productProfileId: toInt(productProfileId) } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: String(q), mode: 'insensitive' } },
              { productProfile: { name: { contains: String(q), mode: 'insensitive' } } },
            ],
          }
        : {}),
    })

    const rows = await prisma.productTemplate.findMany({
      where,
      include: { productProfile: true },
      orderBy: { name: 'asc' },
      take: limit,
    })

    const templates = rows.map((t) => ({
      id: t.id,
      name: t.name,
      productProfileId: t.productProfileId ?? null,
    }))

    res.set('Cache-Control', 'no-store')
    res.json(templates)
  } catch (error) {
    console.error('❌ [Dropdown ProductTemplate] Error:', error)
    res.status(500).json({ error: 'ไม่สามารถดึง dropdown เทมเพลตได้' })
  }
}

module.exports = {
  getAllProductTemplates,
  createProductTemplate,
  updateProductTemplate,
  archiveProductTemplate,
  restoreProductTemplate,
  getProductTemplateById,
  getProductTemplateDropdowns,
  deleteProductTemplate, // ไว้เพื่อความเข้ากันได้ ถึงแม้ routes จะไม่ใช้แล้ว
}


