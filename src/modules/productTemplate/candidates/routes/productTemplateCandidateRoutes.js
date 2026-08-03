const express = require('express')
const verifyToken = require('../../../../../middlewares/verifyToken')
const {
  createProductTemplateCandidate,
} = require('../create/createProductTemplateCandidateController')
const {
  listProductTemplateCandidates,
} = require('../query/list/listProductTemplateCandidatesController')
const {
  getProductTemplateCandidate,
} = require('../query/detail/getProductTemplateCandidateController')
const {
  startProductTemplateCandidateReview,
} = require('../review/start/startProductTemplateCandidateReviewController')
const {
  rejectProductTemplateCandidate,
} = require('../review/reject/rejectProductTemplateCandidateController')
const {
  mergeProductTemplateCandidate,
} = require('../promotion/merge/mergeProductTemplateCandidateController')
const {
  promoteProductTemplateCandidate,
} = require('../promotion/promote/promoteProductTemplateCandidateController')

const router = express.Router()

const requireSuperAdmin = (req, res, next) => {
  const role = String(req.user?.role || '').trim().toUpperCase()
  if (role !== 'SUPERADMIN') {
    return res.status(403).json({ error: 'Forbidden', code: 'SUPERADMIN_REQUIRED' })
  }
  return next()
}

router.use(verifyToken)
router.use(requireSuperAdmin)

router.get('/', listProductTemplateCandidates)
router.post('/', createProductTemplateCandidate)
router.post('/:id/start-review', startProductTemplateCandidateReview)
router.post('/:id/reject', rejectProductTemplateCandidate)
router.post('/:id/merge', mergeProductTemplateCandidate)
router.post('/:id/promote', promoteProductTemplateCandidate)
router.get('/:id', getProductTemplateCandidate)

module.exports = router
