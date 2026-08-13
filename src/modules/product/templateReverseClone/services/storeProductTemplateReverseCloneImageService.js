'use strict'

const { prisma } = require('../../../../lib/prisma')
const { cloudinary } = require('../../../../utils/cloudinary')

const buildReverseCloneImagePublicId = ({ templateProductId, sourceProductId, sourceImageId }) =>
  `products/template-reverse/${Number(templateProductId)}/source-${Number(sourceProductId)}-${Number(sourceImageId)}`

const loadReverseCloneImageAuthority = async ({ sourceProductId, templateProductId, db = prisma }) => {
  const source = await db.product.findUnique({
    where: { id: Number(sourceProductId) },
    select: {
      id: true,
      templateProductId: true,
      productImages: {
        where: { active: true },
        orderBy: [{ isCover: 'desc' }, { id: 'asc' }],
        select: { id: true, url: true, secure_url: true, caption: true, isCover: true },
      },
    },
  })

  if (!source?.id) throw Object.assign(new Error('SOURCE_PRODUCT_NOT_FOUND'), { code: 'SOURCE_PRODUCT_NOT_FOUND' })

  const targetId = Number(templateProductId || source.templateProductId) || null
  if (!targetId || Number(source.templateProductId) !== targetId) {
    throw Object.assign(new Error('SOURCE_TEMPLATE_LINK_REQUIRED'), { code: 'SOURCE_TEMPLATE_LINK_REQUIRED' })
  }

  const template = await db.product.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      active: true,
      productImages: {
        where: { active: true },
        select: { id: true, public_id: true, isCover: true },
      },
    },
  })

  if (!template?.id || template.active === false) {
    throw Object.assign(new Error('TEMPLATE_PRODUCT_NOT_AVAILABLE'), { code: 'TEMPLATE_PRODUCT_NOT_AVAILABLE' })
  }

  return { source, template }
}

const syncStoreProductImagesToTemplate = async ({ sourceProductId, templateProductId, db = prisma, uploader = cloudinary.uploader } = {}) => {
  const { source, template } = await loadReverseCloneImageAuthority({ sourceProductId, templateProductId, db })
  const sourceImages = source.productImages || []

  if (sourceImages.length === 0) {
    return { status: 'SKIPPED_NO_SOURCE_IMAGES', sourceProductId: source.id, templateProductId: template.id, synced: 0 }
  }

  const targetByPublicId = new Map((template.productImages || []).map((image) => [image.public_id, image]))
  const expectedIds = new Set(sourceImages.map((image) => buildReverseCloneImagePublicId({
    templateProductId: template.id,
    sourceProductId: source.id,
    sourceImageId: image.id,
  })))

  const unmanaged = (template.productImages || []).filter((image) => !expectedIds.has(image.public_id))
  if (unmanaged.length > 0) {
    return { status: 'SKIPPED_TARGET_HAS_IMAGES', sourceProductId: source.id, templateProductId: template.id, synced: 0 }
  }

  let synced = 0
  let alreadySynced = 0
  const failures = []

  for (const sourceImage of sourceImages) {
    const publicId = buildReverseCloneImagePublicId({
      templateProductId: template.id,
      sourceProductId: source.id,
      sourceImageId: sourceImage.id,
    })

    if (targetByPublicId.has(publicId)) {
      alreadySynced += 1
      continue
    }

    const sourceUrl = sourceImage.secure_url || sourceImage.url
    if (!sourceUrl) {
      failures.push({ sourceImageId: sourceImage.id, reason: 'SOURCE_IMAGE_URL_REQUIRED' })
      continue
    }

    try {
      const uploaded = await uploader.upload(sourceUrl, { public_id: publicId, resource_type: 'image', overwrite: false })

      if (sourceImage.isCover === true) {
        await db.productImage.updateMany({ where: { productId: template.id, active: true }, data: { isCover: false } })
      }

      const created = await db.productImage.create({
        data: {
          productId: template.id,
          url: uploaded.secure_url,
          secure_url: uploaded.secure_url,
          public_id: uploaded.public_id,
          caption: sourceImage.caption || '',
          isCover: sourceImage.isCover === true,
          active: true,
        },
        select: { id: true, public_id: true },
      })
      targetByPublicId.set(created.public_id, created)
      synced += 1
    } catch (error) {
      const existing = await db.productImage.findFirst({
        where: { productId: template.id, public_id: publicId, active: true },
        select: { id: true, public_id: true },
      })
      if (existing) {
        targetByPublicId.set(existing.public_id, existing)
        alreadySynced += 1
      } else {
        failures.push({ sourceImageId: sourceImage.id, reason: error?.code || error?.message || 'TEMPLATE_IMAGE_SYNC_FAILED' })
      }
    }
  }

  return {
    status: failures.length > 0 ? 'PARTIAL' : (synced > 0 ? 'SYNCED' : 'ALREADY_SYNCED'),
    sourceProductId: source.id,
    templateProductId: template.id,
    sourceImages: sourceImages.length,
    synced,
    alreadySynced,
    failures,
  }
}

module.exports = { buildReverseCloneImagePublicId, loadReverseCloneImageAuthority, syncStoreProductImagesToTemplate }
