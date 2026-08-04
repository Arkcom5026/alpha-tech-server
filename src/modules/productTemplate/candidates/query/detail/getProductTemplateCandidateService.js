const repository = require('./getProductTemplateCandidateRepository')
const {
  createHttpError,
  assertSuperAdmin,
  toPositiveInt,
} = require('../../shared/productTemplateCandidatePolicy')

const getCandidate = async ({ user, candidateId }) => {
  assertSuperAdmin(user)
  const id = toPositiveInt(candidateId, 'candidateId')
  const candidate = await repository.findCandidateById({ candidateId: id })

  if (!candidate) {
    throw createHttpError(
      404,
      'Product template candidate was not found',
      'PRODUCT_TEMPLATE_CANDIDATE_NOT_FOUND'
    )
  }

  return candidate
}

module.exports = { getCandidate }
