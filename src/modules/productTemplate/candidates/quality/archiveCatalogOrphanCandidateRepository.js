const { prisma } = require('../../../../../lib/prisma')

const archiveCatalogOrphanCandidateTransaction = ({ candidateId, actorEmployeeId, decisionNote, resolvedAt }) =>
  prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtext($1))::text',
      `product-template-orphan-archive:${Number(candidateId)}`
    )

    const candidate = await tx.productTemplateCandidate.findUnique({
      where: { id: Number(candidateId) },
      select: {
        id: true,
        type: true,
        status: true,
        templateBranchId: true,
        primaryTemplateProductId: true,
        resolution: true,
      },
    })

    if (!candidate) return { outcome: 'NOT_FOUND', candidate: null }
    if (candidate.status === 'ARCHIVED') return { outcome: 'ALREADY_ARCHIVED', candidate }
    if (candidate.type !== 'ORPHAN_UNUSED' || !['OPEN', 'UNDER_REVIEW'].includes(candidate.status)) {
      return { outcome: 'INVALID_STATE', candidate }
    }

    const product = await tx.product.findFirst({
      where: {
        id: Number(candidate.primaryTemplateProductId),
        active: true,
        productType: { branchId: Number(candidate.templateBranchId) },
      },
      select: {
        id: true,
        name: true,
        active: true,
        _count: { select: { clonedProducts: true } },
      },
    })

    if (!product) return { outcome: 'PRODUCT_INVALID', candidate }
    if ((product._count?.clonedProducts || 0) !== 0) {
      return { outcome: 'STILL_REFERENCED', candidate, referenceCount: product._count.clonedProducts }
    }

    await tx.product.update({
      where: { id: product.id },
      data: { active: false },
      select: { id: true },
    })

    const remainingReferences = await tx.product.count({
      where: { templateProductId: product.id },
    })
    if (remainingReferences !== 0) {
      const error = new Error('Template Product received references during orphan archive')
      error.code = 'ORPHAN_PRODUCT_REFERENCE_RACE'
      error.statusCode = 409
      throw error
    }

    const resolution = {
      authority: 'TEMPLATE_CATALOG_QUALITY',
      action: 'ARCHIVE_ORPHAN_TEMPLATE',
      templateProductId: product.id,
      localReferenceCount: 0,
      resolvedAt: resolvedAt.toISOString(),
    }

    const updatedCandidate = await tx.productTemplateCandidate.update({
      where: { id: candidate.id },
      data: {
        status: 'ARCHIVED',
        resolution,
        resolvedAt,
        reviewedAt: resolvedAt,
        reviewedByEmployeeId: actorEmployeeId,
        decisionNote,
      },
    })

    const event = await tx.productTemplateCandidateEvent.create({
      data: {
        candidateId: candidate.id,
        eventType: 'ORPHAN_ARCHIVED',
        previousStatus: candidate.status,
        resultingStatus: 'ARCHIVED',
        actorEmployeeId,
        note: decisionNote,
        metadata: resolution,
      },
    })

    return { outcome: 'ARCHIVED', candidate: updatedCandidate, productId: product.id, event }
  })

module.exports = { archiveCatalogOrphanCandidateTransaction }
