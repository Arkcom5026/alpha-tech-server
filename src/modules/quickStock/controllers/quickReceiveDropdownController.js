// src/modules/quickStock/controllers/quickReceiveDropdownController.js
// Workflow-specific dropdowns for Quick Receive / QuickStock search.
// This endpoint is intentionally isolated from Product Create dropdowns.

const { prisma } = require('../../../../lib/prisma')

const TEMPLATE_BRANCH_CODE = 'T01'

const toPositiveInt = (value) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

const normalizeName = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()

const dedupeByName = (items = []) => {
  const seen = new Set()
  const result = []

  for (const item of Array.isArray(items) ? items : []) {
    const id = toPositiveInt(item?.id)
    const name = String(item?.name ?? '').trim()
    if (!id || !name) continue

    const key = normalizeName(name)
    if (!key || seen.has(key)) continue

    seen.add(key)
    result.push({ id, name })
  }

  return result.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'th'))
}

const getQuickReceiveDropdowns = async (req, res) => {
  try {
    const productTypeId = toPositiveInt(req.query?.productTypeId)

    const templateBranch = await prisma.branch.findFirst({
      where: { branchCode: TEMPLATE_BRANCH_CODE },
      select: { id: true, branchCode: true },
    })

    if (!templateBranch?.id) {
      return res.status(404).json({
        success: false,
        code: 'TEMPLATE_BRANCH_NOT_FOUND',
        message: 'ไม่พบ Template Branch สำหรับ Quick Receive Dropdown',
      })
    }

    const where = {
      active: true,
      productType: {
        branchId: templateBranch.id,
      },
      ...(productTypeId ? { productTypeId } : {}),
    }

    const rows = await prisma.product.findMany({
      where,
      select: {
        productType: {
          select: {
            id: true,
            name: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
            active: true,
          },
        },
      },
      orderBy: [{ productType: { name: 'asc' } }, { brand: { name: 'asc' } }, { id: 'asc' }],
      take: 5000,
    })

    const productTypes = dedupeByName(rows.map((row) => row.productType).filter(Boolean))
    const brands = dedupeByName(
      rows
        .map((row) => row.brand)
        .filter((brand) => brand && brand.active !== false)
    )

    res.set('Cache-Control', 'no-store')
    return res.json({
      success: true,
      workflow: 'quick-receive',
      source: 'template-catalog',
      productTypes,
      brands,
    })
  } catch (error) {
    console.error('❌ getQuickReceiveDropdowns error:', error)
    return res.status(500).json({
      success: false,
      code: 'QUICK_RECEIVE_DROPDOWNS_FAILED',
      message: 'ไม่สามารถโหลด Dropdown สำหรับ Quick Receive ได้',
    })
  }
}

module.exports = {
  getQuickReceiveDropdowns,
}
