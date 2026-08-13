const { BusinessType } = require('@prisma/client')
const repository = require('./listProductTemplateCandidatesRepository')
const { createHttpError, assertSuperAdmin, toPositiveInt } = require('../../shared/productTemplateCandidatePolicy')

const ALLOWED_STATUSES = new Set(['DRAFT','OPEN','UNDER_REVIEW','REJECTED','PROMOTED','MERGED','CANCELLED','RESOLVED','DISMISSED','ARCHIVED'])
const ALLOWED_BUSINESS_TYPES = new Set(Object.values(BusinessType))
const ALLOWED_SORT_FIELDS = new Set(['createdAt','updatedAt','reviewedAt','resolvedAt','promotedAt','status','type'])

const toPageNumber = (value, fallback) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const normalizeStatus = (value) => {
  if (value === undefined || value === null || value === '') return null
  const status = String(value).trim().toUpperCase()
  if (!ALLOWED_STATUSES.has(status)) throw createHttpError(400, 'Invalid candidate status', 'INVALID_CANDIDATE_STATUS')
  return status
}

const normalizeBusinessType = (value) => {
  if (value === undefined || value === null || value === '') return null
  const businessType = String(value).trim().toUpperCase()
  if (!ALLOWED_BUSINESS_TYPES.has(businessType)) throw createHttpError(400, 'Invalid business type', 'INVALID_BUSINESS_TYPE')
  return businessType
}

const normalizeSearch = (value) => String(value || '').trim().slice(0, 200)

const resolveOrderBy = (query = {}) => {
  const sortBy = ALLOWED_SORT_FIELDS.has(String(query.sortBy || '').trim()) ? String(query.sortBy).trim() : 'createdAt'
  const direction = String(query.sortDirection || '').trim().toLowerCase() === 'asc' ? 'asc' : 'desc'
  return [{ [sortBy]: direction }, { id: direction }]
}

const buildSearchWhere = (q) => {
  if (!q) return null
  const candidateId = Number.parseInt(q, 10)
  return { OR: [
    ...(Number.isInteger(candidateId) && candidateId > 0 ? [{ id: candidateId }] : []),
    { sourceProduct: { name: { contains: q, mode: 'insensitive' } } },
    { sourceBranch: { name: { contains: q, mode: 'insensitive' } } },
    { targetTemplateProduct: { name: { contains: q, mode: 'insensitive' } } },
    { targetTemplateBranch: { name: { contains: q, mode: 'insensitive' } } },
  ] }
}

const listCandidates = async ({ user, query = {} }) => {
  assertSuperAdmin(user)
  const page = toPageNumber(query.page, 1)
  const pageSize = Math.min(toPageNumber(query.pageSize, 30), 100)
  const status = normalizeStatus(query.status)
  const businessType = normalizeBusinessType(query.businessType)
  const q = normalizeSearch(query.q || query.search)
  const sourceBranchId = query.sourceBranchId ? toPositiveInt(query.sourceBranchId, 'sourceBranchId') : null
  const targetTemplateBranchId = query.targetTemplateBranchId ? toPositiveInt(query.targetTemplateBranchId, 'targetTemplateBranchId') : null
  const templateBranchId = query.templateBranchId ? toPositiveInt(query.templateBranchId, 'templateBranchId') : null
  const reviewerId = query.reviewerId ? toPositiveInt(query.reviewerId, 'reviewerId') : null

  const templateBranches = businessType ? await repository.findTemplateBranchIdsByBusinessType({ businessType }) : []
  const templateBranchIds = templateBranches.map((branch) => branch.id)
  const conditions = []
  if (businessType) conditions.push({ OR: [
    { sourceBranch: { businessType } },
    ...(templateBranchIds.length ? [{ templateBranchId: { in: templateBranchIds } }] : []),
  ] })
  if (sourceBranchId) conditions.push({ sourceBranchId })
  if (targetTemplateBranchId) conditions.push({ targetTemplateBranchId })
  if (templateBranchId) conditions.push({ templateBranchId })
  if (reviewerId) conditions.push({ reviewedByEmployeeId: reviewerId })
  const searchWhere = buildSearchWhere(q)
  if (searchWhere) conditions.push(searchWhere)

  const summaryWhere = conditions.length ? { AND: conditions } : {}
  const where = status ? { AND: [...conditions, { status }] } : summaryWhere
  const [items, total, statusGroups, workloadGroups] = await repository.listCandidates({
    where, summaryWhere, skip: (page - 1) * pageSize, take: pageSize, orderBy: resolveOrderBy(query),
  })

  const statusSummary = Object.fromEntries([...ALLOWED_STATUSES].map((item) => [item, 0]))
  for (const group of statusGroups) statusSummary[group.status] = group._count._all
  const workloadMap = new Map()
  for (const group of workloadGroups) {
    const reviewer = workloadMap.get(group.reviewedByEmployeeId) || { reviewerId: group.reviewedByEmployeeId, assigned: 0, pending: 0, reviewed: 0 }
    const count = group._count._all
    reviewer.assigned += count
    if (group.status === 'UNDER_REVIEW') reviewer.pending += count
    if (['REJECTED','PROMOTED','MERGED','CANCELLED','RESOLVED','DISMISSED','ARCHIVED'].includes(group.status)) reviewer.reviewed += count
    workloadMap.set(group.reviewedByEmployeeId, reviewer)
  }

  return {
    items,
    filters: { businessType, templateBranchId },
    pagination: { page, pageSize, total, totalPages: total === 0 ? 0 : Math.ceil(total / pageSize) },
    summary: { total: Object.values(statusSummary).reduce((sum, count) => sum + count, 0), byStatus: statusSummary },
    reviewerWorkload: [...workloadMap.values()].sort((a, b) => b.pending - a.pending || b.assigned - a.assigned),
  }
}

module.exports = { ALLOWED_STATUSES, ALLOWED_BUSINESS_TYPES, ALLOWED_SORT_FIELDS, normalizeStatus, normalizeBusinessType, resolveOrderBy, listCandidates }
