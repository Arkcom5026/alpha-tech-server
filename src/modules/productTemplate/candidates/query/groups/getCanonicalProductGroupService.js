const { auditDiscovery } = require('../../../discovery/auditProductTemplateDiscoveryService')
const { createHttpError } = require('../../../shared/productTemplateCandidatePolicy')

const decodeGroupKey = (value) => {
  const raw = String(value || '').trim()
  if (!raw) throw createHttpError(400, 'groupKey is required', 'GROUP_KEY_REQUIRED')
  try {
    return decodeURIComponent(raw)
  } catch {
    throw createHttpError(400, 'Invalid groupKey', 'INVALID_GROUP_KEY')
  }
}

const getCanonicalProductGroup = async ({ user, params = {}, query = {} }) => {
  const groupKey = decodeGroupKey(params.groupKey)
  const audit = await auditDiscovery({ user, query: { businessType: query.businessType } })
  const group = (audit.groups || []).find((item) => item.groupKey === groupKey)

  if (!group) {
    throw createHttpError(404, 'Canonical Product Group not found', 'CANONICAL_GROUP_NOT_FOUND')
  }

  return {
    businessType: audit.businessType,
    templateBranch: audit.templateBranch,
    categoryId: audit.categoryId,
    group,
  }
}

module.exports = {
  decodeGroupKey,
  getCanonicalProductGroup,
}
