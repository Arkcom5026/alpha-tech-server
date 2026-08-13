const { prisma } = require('../../../../../lib/prisma')

const resolveDuplicateTransaction = ({
  candidateId,
  canonicalTemplateProductId,
  duplicateTemplateProductId,
  actorEmployeeId,
  decisionNote,
  resolvedAt,
}) =>
  prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtext($1))::text',
      `product-template-candidate-duplicate-resolution:${Number(candidateId)}`
    )

    const candidate = await tx.productTemplateCandidate.findUnique({
      where: { id: Number(candidateId) },
      select: {
        id: true,
        type: true,
        status: true,
        templateBranchId: true,
        primaryTemplateProductId: true,
        comparisonTemplateProductId: true,
        resolution: true,
      },
    })
    if (!candidate) return { outcome: 'NOT_FOUND' }
    if (candidate.type !== 'POSSIBLE_DUPLICATE') {
      return { outcome: 'INVALID_TYPE', candidate }
    }
    if (candidate.status === 'RESOLVED') {
      return { outcome: 'ALREADY_RESOLVED', candidate }
    }
    if (!['OPEN', 'UNDER_REVIEW'].includes(candidate.status)) {
      return { outcome: 'INVALID_STATUS', candidate }
    }

    const pair = new Set([
      Number(candidate.primaryTemplateProductId),
      Number(candidate.comparisonTemplateProductId),
    ])
    if (
      pair.size !== 2 ||
      !pair.has(Number(canonicalTemplateProductId)) ||
      !pair.has(Number(duplicateTemplateProductId)) ||
      Number(canonicalTemplateProductId) === Number(duplicateTemplateProductId)
    ) {
      return { outcome: 'INVALID_PAIR', candidate }
    }

    const products = await tx.product.findMany({
      where: {
        id: { in: [Number(canonicalTemplateProductId), Number(duplicateTemplateProductId)] },
        productType: { branchId: Number(candidate.templateBranchId) },
      },
      select: {
        id: true,
        name: true,
        active: true,
        productType: { select: { branchId: true } },
      },
      orderBy: { id: 'asc' },
    })
    if (products.length !== 2) {
      return { outcome: 'TEMPLATE_PAIR_INVALID', candidate }
    }

    const canonical = products.find((item) => item.id === Number(canonicalTemplateProductId))
    const duplicate = products.find((item) => item.id === Number(duplicateTemplateProductId))
    if (!canonical || !duplicate || canonical.active === false) {
      return { outcome: 'TEMPLATE_PAIR_INVALID', candidate }
    }

    const relink = await tx.product.updateMany({
      where: { templateProductId: Number(duplicateTemplateProductId) },
      data: { templateProductId: Number(canonicalTemplateProductId) },
    })

    const remainingReferenceCount = await tx.product.count({
      where: { templateProductId: Number(duplicateTemplateProductId) },
    })
    if (remainingReferenceCount !== 0) {
      throw Object.assign(new Error('Duplicate Template Product still has Local Product references'), {
        code: 'DUPLICATE_TEMPLATE_REFERENCES_REMAIN',
        statusCode: 409,
      })
    }

    await tx.product.update({
      where: { id: Number(duplicateTemplateProductId) },
      data: { active: false },
      select: { id: true, active: true },
    })

    const resolution = {
      authority: 'TEMPLATE_CATALOG_QUALITY',
      action: 'MERGE_DUPLICATE',
      canonicalTemplateProductId: Number(canonicalTemplateProductId),
      duplicateTemplateProductId: Number(duplicateTemplateProductId),
      relinkedLocalProductCount: relink.count,
      remainingDuplicateReferenceCount: remainingReferenceCount,
      duplicateRetired: true,
    }

    const updated = await tx.productTemplateCandidate.update({
      where: { id: Number(candidateId) },
      data: {
        status: 'RESOLVED',
        resolution,
        resolvedAt,
        reviewedAt: resolvedAt,
        reviewedByEmployeeId: actorEmployeeId,
        decisionNote,
      },
      select: {
        id: true,
        type: true,
        status: true,
        templateBranchId: true,
        primaryTemplateProductId: true,
        comparisonTemplateProductId: true,
        resolution: true,
        resolvedAt: true,
        reviewedByEmployeeId: true,
        decisionNote: true,
      },
    })

    const event = await tx.productTemplateCandidateEvent.create({
      data: {
        candidateId: Number(candidateId),
        eventType: 'DUPLICATE_RESOLVED',
        previousStatus: candidate.status,
        resultingStatus: 'RESOLVED',
        actorEmployeeId,
        note: decisionNote,
        metadata: resolution,
      },
    })

    return {
      outcome: 'RESOLVED',
      candidate: updated,
      canonicalTemplateProduct: canonical,
      duplicateTemplateProduct: { ...duplicate, active: false },
      relinkedLocalProductCount: relink.count,
      remainingReferenceCount,
      event,
    }
  })

module.exports = {
  resolveDuplicateTransaction,
}
