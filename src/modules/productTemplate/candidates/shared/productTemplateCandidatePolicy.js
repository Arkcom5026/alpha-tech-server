const createHttpError = (statusCode, message, code) => {
  const error = new Error(message)
  error.statusCode = statusCode
  error.code = code
  return error
}

const toPositiveInt = (value, fieldName) => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createHttpError(400, `${fieldName} must be a positive integer`, 'INVALID_CANDIDATE_INPUT')
  }
  return parsed
}

const assertSuperAdmin = (user) => {
  const role = String(user?.role || '').trim().toUpperCase()
  if (role !== 'SUPERADMIN') {
    throw createHttpError(403, 'Superadmin authority is required', 'SUPERADMIN_REQUIRED')
  }
}

const resolveActorEmployeeId = (user) => {
  const value = user?.employeeId ?? user?.activeProfileId ?? user?.profileId
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

module.exports = {
  createHttpError,
  toPositiveInt,
  assertSuperAdmin,
  resolveActorEmployeeId,
}
