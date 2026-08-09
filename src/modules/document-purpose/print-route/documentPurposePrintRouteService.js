'use strict'

const repository = require('./documentPurposePrintRouteRepository')

const fail = (code, message, statusCode = 400) => Object.assign(new Error(message), { code, statusCode })
const positiveInt = (value, field) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) throw fail('DOCUMENT_PRINT_ROUTE_INPUT_INVALID', `${field} must be a positive integer`)
  return parsed
}
const branchIdFromUser = (user) => positiveInt(user?.branchId, 'branchId')
const normalizeCapability = (value) => String(value || 'PRINT').trim().toUpperCase()
const normalizeCopies = (value) => {
  const copies = value == null ? 1 : Number(value)
  if (!Number.isInteger(copies) || copies < 1 || copies > 20) throw fail('DOCUMENT_PRINT_ROUTE_COPIES_INVALID', 'copies must be between 1 and 20')
  return copies
}

const createDocumentPurposePrintRouteService = (repo = repository) => ({
  list({ user }) {
    return repo.list({ branchId: branchIdFromUser(user) })
  },

  async get({ user, definitionId }) {
    const branchId = branchIdFromUser(user)
    const id = positiveInt(definitionId, 'definitionId')
    const route = await repo.findByDefinition({ branchId, definitionId: id })
    if (!route) throw fail('DOCUMENT_PRINT_ROUTE_NOT_FOUND', 'Print route is not configured', 404)
    return route
  },

  async configure({ user, definitionId, payload = {} }) {
    const branchId = branchIdFromUser(user)
    const id = positiveInt(definitionId, 'definitionId')
    const printerProfileId = positiveInt(payload.printerProfileId, 'printerProfileId')
    const [definition, profile] = await Promise.all([
      repo.findDefinition({ branchId, definitionId: id }),
      repo.findProfile({ branchId, printerProfileId }),
    ])
    if (!definition) throw fail('DOCUMENT_PURPOSE_NOT_FOUND', 'Document purpose not found for branch', 404)
    if (definition.lifecycleState !== 'ACTIVE' || definition.metadata?.printEligible !== true) {
      throw fail('DOCUMENT_PURPOSE_PRINT_NOT_ELIGIBLE', 'Document purpose is not active and print eligible', 409)
    }
    if (!profile) throw fail('PRINT_PROFILE_NOT_FOUND', 'Printer profile not found for branch', 404)
    if (!profile.isActive) throw fail('PRINT_PROFILE_INACTIVE', 'Printer profile is inactive', 409)
    return repo.upsert({
      branchId,
      definitionId: id,
      data: {
        printerProfileId,
        requiredCapability: normalizeCapability(payload.requiredCapability),
        copies: normalizeCopies(payload.copies),
        priority: Number.isInteger(Number(payload.priority)) ? Number(payload.priority) : 100,
        isActive: payload.isActive !== false,
      },
    })
  },

  async disable({ user, definitionId }) {
    const branchId = branchIdFromUser(user)
    const id = positiveInt(definitionId, 'definitionId')
    if (!await repo.findByDefinition({ branchId, definitionId: id })) {
      throw fail('DOCUMENT_PRINT_ROUTE_NOT_FOUND', 'Print route is not configured', 404)
    }
    return repo.disable({ branchId, definitionId: id })
  },
})

module.exports = { createDocumentPurposePrintRouteService, normalizeCapability, normalizeCopies }
