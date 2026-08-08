'use strict'

const repository = require('./printerProfileRepository')
const { requireBranchAuthority } = require('../policies/storeDeviceAuthorityPolicy')

const fail = (code, message, statusCode = 400) => Object.assign(new Error(message), { code, statusCode })
const positiveInt = (value, field = 'id') => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) throw fail('PRINT_PROFILE_INPUT_INVALID', `${field} must be a positive integer`)
  return parsed
}
const text = (value, field) => {
  const result = String(value || '').trim()
  if (!result) throw fail('PRINT_PROFILE_INPUT_INVALID', `${field} is required`)
  return result
}
const normalizeCode = (value) => text(value, 'code').normalize('NFKC').toUpperCase().replace(/[\s-]+/g, '_')
const normalizeCapabilities = (value = {}) => ({
  print: value.print !== false,
  cut: value.cut === true,
  color: value.color === true,
  duplex: value.duplex === true,
})

const createPrinterProfileService = (repo = repository) => ({
  list: ({ user }) => repo.list({ branchId: requireBranchAuthority(user) }),

  async create({ user, payload = {} }) {
    const branchId = requireBranchAuthority(user)
    const code = text(payload.code, 'code')
    const normalizedCode = normalizeCode(code)
    if (await repo.findByCode({ branchId, normalizedCode })) {
      throw fail('PRINT_PROFILE_CODE_CONFLICT', 'Printer profile code already exists for branch', 409)
    }
    return repo.create({
      data: {
        branchId,
        code,
        normalizedCode,
        displayName: text(payload.displayName, 'displayName'),
        manufacturer: payload.manufacturer ? String(payload.manufacturer).trim() : null,
        modelName: payload.modelName ? String(payload.modelName).trim() : null,
        capabilities: normalizeCapabilities(payload.capabilities),
        paperProfile: payload.paperProfile || null,
        adapterKind: payload.adapterKind ? String(payload.adapterKind).trim() : null,
        transportKind: payload.transportKind ? String(payload.transportKind).trim() : null,
        isActive: payload.isActive !== false,
      },
    })
  },

  async update({ user, profileId, payload = {} }) {
    const branchId = requireBranchAuthority(user)
    const id = positiveInt(profileId, 'profileId')
    const current = await repo.findById({ branchId, id })
    if (!current) throw fail('PRINT_PROFILE_NOT_FOUND', 'Printer profile not found for branch', 404)
    const data = {}
    for (const field of ['displayName', 'manufacturer', 'modelName', 'adapterKind', 'transportKind']) {
      if (Object.prototype.hasOwnProperty.call(payload, field)) data[field] = payload[field] == null ? null : text(payload[field], field)
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'capabilities')) data.capabilities = normalizeCapabilities(payload.capabilities)
    if (Object.prototype.hasOwnProperty.call(payload, 'paperProfile')) data.paperProfile = payload.paperProfile || null
    if (Object.prototype.hasOwnProperty.call(payload, 'isActive')) data.isActive = payload.isActive === true
    return repo.update({ branchId, id, data })
  },
})

module.exports = { createPrinterProfileService, normalizeCapabilities, normalizeCode, positiveInt }
